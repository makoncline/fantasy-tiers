import fs from "node:fs/promises";
import path from "node:path";
import dayjs from "dayjs";

type Scoring = "STD" | "HALF" | "PPR";

const PAGES: Record<Scoring, string> = {
  STD: "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php",
  HALF: "https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php",
  PPR: "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php",
};

type EcrItem = {
  player_id: number;
  player_name: string;
  player_positions: string;
  player_short_name: string;
  player_filename?: string | null;
  player_team_id: string | null;
  player_bye_week?: string | number | null;
  rank_ecr: number;
  rank_min: string | number | null;
  rank_max: string | number | null;
  rank_ave: string | number | null;
  rank_std: string | number | null;
  player_owned_avg: number | string | null;
  pos_rank: string | null;
  tier: number | null;
};

function extractJson<T>(html: string, varName: string): T {
  const pattern = new RegExp(
    `var\\s+${varName}\\s*=\\s*(\\[.*?\\]|\\{[\\s\\S]*?\\});`,
    "s"
  );
  const match = html.match(pattern);
  if (!match) throw new Error(`Could not find ${varName}`);
  const jsonText = match[1];
  if (!jsonText) throw new Error(`Could not extract JSON for ${varName}`);
  return JSON.parse(jsonText) as T;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

function toNumberSafe(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

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
    JSON.stringify({ meta: metadata, raw: rawAny, rows }, null, 2),
    "utf8"
  );
}

async function scrapeOne(scoring: Scoring) {
  const url = PAGES[scoring];
  const html = await fetchHtml(url);
  const ecrRaw = extractJson<any>(html, "ecrData");

  const ecrData: EcrItem[] = Array.isArray(ecrRaw)
    ? ecrRaw
    : Array.isArray(ecrRaw.players)
    ? ecrRaw.players
    : (() => {
        throw new Error("ecrData not array or missing players");
      })();

  const rows = ecrData.map((e) => {
    return {
      player_id: e.player_id,
      player_name: e.player_name,
      player_short_name: e.player_short_name,
      player_filename: e.player_filename ?? "",
      player_positions: e.player_positions,
      player_team_id: e.player_team_id ?? "",
      player_bye_week: e.player_bye_week ?? null,
      rank_ecr: toNumberSafe(e.rank_ecr),
      rank_min: toNumberSafe(e.rank_min),
      rank_max: toNumberSafe(e.rank_max),
      rank_ave: toNumberSafe(e.rank_ave),
      rank_std: toNumberSafe(e.rank_std),
      player_owned_avg: toNumberSafe(e.player_owned_avg as any),
      pos_rank: e.pos_rank ?? "",
      tier: e.tier ?? null,
    };
  });

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

async function main() {
  const arg = process.argv[2];
  if (arg) {
    const scoring = arg.toUpperCase() as Scoring;
    if (!PAGES[scoring]) throw new Error(`Unknown scoring: ${arg}`);
    await scrapeOne(scoring);
  } else {
    for (const s of Object.keys(PAGES) as Scoring[]) {
      await scrapeOne(s);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
