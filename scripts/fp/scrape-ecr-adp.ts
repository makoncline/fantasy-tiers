import fs from "node:fs/promises";
import path from "node:path";
import dayjs from "dayjs";
import {
  buildWeeklyUrl,
  extractJson,
  fetchHtml,
  parseEcrRows,
  type Scoring,
  type FantasyProsEcrItem,
  type Position,
} from "@/lib/fantasyprosScrape";

// Scoring type is imported from shared helper

const PAGES: Record<Scoring, string> = {
  STD: "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php",
  HALF: "https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php",
  PPR: "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php",
};

// Using FantasyProsEcrItem from shared helper

// extractJson is imported from shared helper

// fetchHtml moved to shared helper

// toNumberSafe moved to shared helper

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeCsvAndMeta(
  scoring: Scoring,
  rows: any[],
  rawAny: unknown,
  metaExtras?: Record<string, unknown>
) {
  const outDir = path.join("public", "data", "fantasypros");
  await ensureDir(outDir);
  const baseName = `ECR-ADP-${scoring.toLowerCase()}-draft`;
  const rawDir = path.join(outDir, "raw");
  await ensureDir(rawDir);
  const metaPath = path.join(rawDir, `${baseName}-metadata.json`);
  const rawPath = path.join(rawDir, `${baseName}_raw.json`);

  const metadata = {
    source: "FantasyPros cheat sheets",
    scoring,
    week: "draft",
    accessed: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    rowCount: rows.length,
    ...metaExtras,
  };
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf8");
  await fs.writeFile(
    rawPath,
    JSON.stringify({ raw: rawAny, rows }, null, 2),
    "utf8"
  );
}

async function scrapeOneDraft(scoring: Scoring) {
  const url = PAGES[scoring];
  const html = await fetchHtml(url);
  const ecrRaw = extractJson<any>(html, "ecrData");

  const ecrData: FantasyProsEcrItem[] = Array.isArray(ecrRaw)
    ? ecrRaw
    : Array.isArray(ecrRaw.players)
    ? ecrRaw.players
    : (() => {
        throw new Error("ecrData not array or missing players");
      })();

  const rows = parseEcrRows(ecrData);

  const metaExtras = {
    sources:
      typeof ecrRaw?.experts_available?.total === "number"
        ? ecrRaw.experts_available.total
        : undefined,
    last_updated_ts:
      typeof ecrRaw?.last_updated_ts === "number"
        ? ecrRaw.last_updated_ts
        : undefined,
    url: url,
  };
  await writeCsvAndMeta(scoring, rows, ecrRaw, metaExtras);
}

async function scrapeWeekly(
  position: Position,
  scoring: Scoring,
  week?: number
) {
  const url = buildWeeklyUrl(
    scoring,
    position,
    week && Number.isFinite(week) ? week : undefined
  );
  const html = await fetchHtml(url);
  const ecrRaw = extractJson<any>(html, "ecrData");
  const ecrData: FantasyProsEcrItem[] = Array.isArray(ecrRaw)
    ? ecrRaw
    : Array.isArray(ecrRaw.players)
    ? ecrRaw.players
    : (() => {
        throw new Error("ecrData not array or missing players");
      })();
  const rows = parseEcrRows(ecrData);

  // Derive week from page metadata if not provided
  const derivedWeek = (() => {
    const w = Number(ecrRaw?.week);
    return Number.isFinite(w) && w > 0 ? w : week ?? 0;
  })();

  const outDir = path.join("public", "data", "fantasypros");
  await ensureDir(outDir);
  const baseName = `ECR-weekly-${scoring.toLowerCase()}-${position.toLowerCase()}-week-${derivedWeek}`;
  const rawDir = path.join(outDir, "raw");
  await ensureDir(rawDir);
  const metaPath = path.join(rawDir, `${baseName}-metadata.json`);
  const rawPath = path.join(rawDir, `${baseName}_raw.json`);

  const metadata = {
    source: "FantasyPros weekly rankings",
    scoring: scoring,
    position: position,
    week: derivedWeek,
    accessed: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    rowCount: rows.length,
    url,
    sources:
      typeof ecrRaw?.experts_available?.total === "number"
        ? ecrRaw.experts_available.total
        : undefined,
    last_updated_ts:
      typeof ecrRaw?.last_updated_ts === "number"
        ? ecrRaw.last_updated_ts
        : undefined,
  };
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf8");
  await fs.writeFile(
    rawPath,
    JSON.stringify({ raw: ecrRaw, rows }, null, 2),
    "utf8"
  );
}

async function main() {
  const mode = process.argv[2];
  if (!mode || mode === "draft") {
    const arg = process.argv[3];
    if (arg) {
      const scoring = arg.toUpperCase() as Scoring;
      if (!PAGES[scoring]) throw new Error(`Unknown scoring: ${arg}`);
      await scrapeOneDraft(scoring);
    } else {
      for (const s of Object.keys(PAGES) as Scoring[]) {
        await scrapeOneDraft(s);
      }
    }
    return;
  }

  if (mode === "weekly") {
    const position = (process.argv[3] || "RB").toUpperCase() as Position;
    const scoring = (process.argv[4] || "PPR").toUpperCase() as Scoring;
    const weekArg = process.argv[5];
    const week = Number(weekArg);
    const providedWeek = Number.isFinite(week) && week > 0 ? week : undefined;
    await scrapeWeekly(position, scoring, providedWeek);
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
