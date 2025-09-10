import dayjs from "dayjs";

export type Scoring = "STD" | "HALF" | "PPR";
export type Position = "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DST";

export type FantasyProsEcrItem = {
  player_id: number;
  player_name: string;
  player_positions: string;
  player_short_name: string;
  player_filename?: string | null;
  player_page_url?: string | null;
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
  start_sit_grade?: string | null;
};

export type ParsedEcrRow = {
  player_id: number;
  player_name: string;
  player_short_name: string;
  player_filename: string;
  player_page_url: string;
  player_positions: string;
  player_team_id: string;
  player_bye_week: number | null;
  rank_ecr: number | null;
  rank_min: number | null;
  rank_max: number | null;
  rank_ave: number | null;
  rank_std: number | null;
  player_owned_avg: number | null;
  pos_rank: string;
  tier: number | null;
  start_sit_grade: string | null;
};

export function toNumberSafe(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function extractJson<T>(html: string, varName: string): T {
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

export async function fetchHtml(url: string): Promise<string> {
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

export function buildWeeklyUrl(
  scoring: Scoring,
  position: Position,
  week?: number
): string {
  const base = "https://www.fantasypros.com/nfl/rankings";
  const posLower = position.toLowerCase();
  let path: string;

  // Positions with PPR variants
  if (
    position === "RB" ||
    position === "WR" ||
    position === "TE" ||
    position === "FLEX"
  ) {
    if (scoring === "PPR") path = `${base}/ppr-${posLower}.php`;
    else if (scoring === "HALF")
      path = `${base}/half-point-ppr-${posLower}.php`;
    else path = `${base}/${posLower}.php`;
  } else {
    // QB, K, DST are standard-only for scoring
    if (scoring !== "STD") {
      throw new Error(
        `Scoring ${scoring} not supported for position ${position}`
      );
    }
    if (position === "DST") path = `${base}/dst.php`;
    else path = `${base}/${posLower}.php`;
  }
  if (week && Number.isFinite(week)) {
    return `${path}?week=${week}`;
  }
  return path;
}

export function parseEcrRows(raw: FantasyProsEcrItem[]): ParsedEcrRow[] {
  return raw.map((e) => {
    return {
      player_id: e.player_id,
      player_name: e.player_name,
      player_short_name: e.player_short_name,
      player_filename: e.player_filename ?? "",
      player_page_url: e.player_page_url ?? "",
      player_positions: e.player_positions,
      player_team_id: e.player_team_id ?? "",
      player_bye_week: toNumberSafe(e.player_bye_week),
      rank_ecr: toNumberSafe(e.rank_ecr),
      rank_min: toNumberSafe(e.rank_min),
      rank_max: toNumberSafe(e.rank_max),
      rank_ave: toNumberSafe(e.rank_ave),
      rank_std: toNumberSafe(e.rank_std),
      player_owned_avg: toNumberSafe(e.player_owned_avg as any),
      pos_rank: e.pos_rank ?? "",
      tier: e.tier ?? null,
      start_sit_grade: e.start_sit_grade ?? null,
    } as ParsedEcrRow;
  });
}

export function buildWeeklyMetadata(
  scoring: Scoring,
  position: Position,
  week: number,
  rowCount: number,
  extras?: Record<string, unknown>
) {
  return {
    source: "FantasyPros weekly rankings",
    scoring,
    position,
    week,
    accessed: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    rowCount,
    ...extras,
  } as const;
}
