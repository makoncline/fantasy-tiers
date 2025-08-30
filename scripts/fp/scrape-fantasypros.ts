import fs from "node:fs/promises";
import path from "node:path";
import { load, type CheerioAPI } from "cheerio";
import dayjs from "dayjs";

type Position = "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DST";
type Scoring = "STD" | "PPR" | "HALF";

const BASE = "https://www.fantasypros.com/nfl/projections";

function buildUrl(position: Position, scoring: Scoring, week: string): string {
  const posSlug = position.toLowerCase();
  const scoringParam = scoring;
  const weekParam = week;
  // include high/low columns
  const params = new URLSearchParams({
    "max-yes": "true",
    "min-yes": "true",
    scoring: scoringParam,
    week: weekParam,
  });
  return `${BASE}/${posSlug}.php?${params.toString()}`;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.fantasypros.com/",
      "Cache-Control": "no-cache",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

function normalizeHeader(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/\//g, "-")
    .trim();
}

type ColumnSpec = { group: string; label: string; key: string };

function parseColumns($: CheerioAPI, table: any): ColumnSpec[] {
  const thead = $(table).find("thead");
  const headerRows = thead.find("tr").toArray();
  if (!headerRows.length) return [];

  // First row often contains group headers with colspans
  const firstRow = $(headerRows[0]);
  const groupCells = firstRow.find("th").toArray();
  const groupMap: string[] = [];

  groupCells.forEach((th, index) => {
    const text = normalizeHeader($(th).text());
    const colspanAttr = $(th).attr("colspan");
    const colspan = colspanAttr ? Math.max(1, parseInt(colspanAttr, 10)) : 1;
    // Skip the leading empty cell for Player if present (usually first th has no text)
    if (index === 0 && (!text || /player/i.test(text))) {
      return;
    }
    const group = text || "";
    for (let i = 0; i < colspan; i++) groupMap.push(group);
  });

  // Last header row contains per-column stat labels
  const lastRow = $(headerRows[headerRows.length - 1]);
  const statCells = lastRow.find("th").toArray();
  const statLabels: string[] = [];
  statCells.forEach((th, index) => {
    const text = normalizeHeader($(th).text());
    // Skip the first cell if it corresponds to Player
    if (index === 0 && (/player/i.test(text) || !text)) return;
    if (text) statLabels.push(text);
  });

  // Build ColumnSpec list mapping each stat to its group
  const columns: ColumnSpec[] = [];
  for (let i = 0; i < statLabels.length; i++) {
    const label = statLabels[i];
    const group = groupMap[i] || "";
    const groupKey = group ? group.split(/\s+/)[0].toUpperCase() : "";
    const key = `${groupKey ? groupKey + "_" : ""}${label.toUpperCase()}`;
    columns.push({ group: groupKey, label, key });
  }
  return columns;
}

type Row = Record<string, string>;

function parseTable(html: string) {
  const $ = load(html);
  // Identify the main projections table: use the first big table on the page
  const table = $("table").first();
  if (!table.length) throw new Error("No table found");

  const columns = parseColumns($, table.get(0));
  const rows: Row[] = [];

  table.find("tbody tr").each((_i, tr) => {
    const tds = $(tr).find("td");
    if (!tds.length) return;
    const row: Row = {};

    // First td is player cell
    const firstTd = tds.get(0);
    let linkEl = $(firstTd).find('a[href*="/players/"]').first();
    if (!linkEl.length) {
      linkEl = $(firstTd).find("a").first();
    }
    const name = linkEl.text().trim();
    const href = linkEl.attr("href") || "";
    const filenameMatch = href.match(/\/players\/([^\/]+\.php)/);
    const filename = filenameMatch ? filenameMatch[1] : "";
    // Extract text nodes (excluding child divs and links) to find team code
    const textOnly = $(firstTd)
      .contents()
      .filter(function () {
        // @ts-ignore - cheerio type
        return this.type === "text";
      })
      .toArray()
      .map((n) => $(n).text())
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const teamMatch = textOnly.replace(name, "").match(/\b[A-Z]{2,3}\b/);
    const team = teamMatch ? teamMatch[0] : "";
    row["Player"] = name;
    row["Team"] = team;
    row["PlayerFilename"] = filename;

    // Remaining tds map to stats in order
    tds.slice(1).each((idx, td) => {
      const col = columns[idx];
      if (!col) return;
      const avg = $(td)
        .contents()
        .filter(function () {
          // @ts-ignore - cheerio type
          return this.type === "text";
        })
        .toArray()
        .map((n) => $(n).text())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const high = $(td).find("div.max-cell").first().text().trim();
      const low = $(td).find("div.min-cell").first().text().trim();

      row[`${col.key}_AVG`] = avg;
      if (high) row[`${col.key}_HIGH`] = high;
      if (low) row[`${col.key}_LOW`] = low;
    });

    rows.push(row);
  });

  return { columns, rows };
}

function inferSourcesCount(html: string): number | null {
  // The page shows something like: "Consensus of 5 Sources - Aug 29, 2025"
  const m = html.match(/Consensus of\s+(\d+)\s+Sources/i);
  return m ? Number(m[1]) : null;
}

function inferDate(html: string): string | null {
  // e.g., "Aug 29, 2025" — normalize to YYYY-MM-DD
  const m = html.match(/\b([A-Z][a-z]{2} \d{1,2}, \d{4})\b/);
  if (!m) return null;
  const parsed = dayjs(m[1]);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeOutputs({
  position,
  scoring,
  week,
  columns,
  rows,
  sources,
  date,
  outDir,
}: {
  position: Position;
  scoring: Scoring;
  week: string;
  columns: ColumnSpec[];
  rows: Row[];
  sources: number | null;
  date: string | null;
  outDir: string;
}) {
  await ensureDir(outDir);
  const rawDir = path.join(outDir, "raw");
  await ensureDir(rawDir);
  const metaPath = path.join(
    rawDir,
    `${position}-${scoring.toLowerCase()}-${week}-metadata.json`
  );

  const meta = {
    source: "FantasyPros",
    url: buildUrl(position, scoring, week),
    position,
    scoring,
    week,
    sources,
    date: date ?? dayjs().format("YYYY-MM-DD"),
    scrapedAt: dayjs().toISOString(),
    rowCount: rows.length,
    // Retain column keys for reference
    columns: [
      "Player",
      "Team",
      "PlayerFilename",
      ...columns.flatMap((c) => [
        `${c.key}_AVG`,
        `${c.key}_HIGH`,
        `${c.key}_LOW`,
      ]),
    ],
  };
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");

  // Also write a raw JSON snapshot for easier aggregation
  // rawDir already ensured above
  const rawPath = path.join(
    rawDir,
    `${position}-${scoring.toLowerCase()}-${week}_raw.json`
  );
  await fs.writeFile(
    rawPath,
    JSON.stringify(
      {
        meta,
        rows,
      },
      null,
      2
    ),
    "utf8"
  );
}

async function scrapeOne(
  position: Position,
  scoring: Scoring,
  week: string,
  outDir: string
) {
  const url = buildUrl(position, scoring, week);
  const html = await fetchHtml(url);
  const { columns, rows } = parseTable(html);
  const sources = inferSourcesCount(html);
  const date = inferDate(html);
  await writeOutputs({
    position,
    scoring,
    week,
    columns,
    rows,
    sources,
    date,
    outDir,
  });
}

async function main() {
  const outDir = path.resolve("public", "data", "fantasypros");
  const week = process.env.WEEK ?? "draft";
  const positions: Position[] = (process.env.POSITIONS?.split(
    ","
  ) as Position[]) ?? ["RB"];
  const scoringTypes: Scoring[] = (process.env.SCORING?.split(
    ","
  ) as Scoring[]) ?? ["STD"];

  for (const position of positions) {
    for (const scoring of scoringTypes) {
      // eslint-disable-next-line no-console
      console.log(`Scraping ${position} ${scoring} ${week} ...`);
      await scrapeOne(position, scoring, week, outDir);
    }
  }
  // eslint-disable-next-line no-console
  console.log("Done.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
