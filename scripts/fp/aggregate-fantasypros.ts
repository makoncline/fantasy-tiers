import fs from "node:fs/promises";
import path from "node:path";

type Scoring = "STD" | "HALF" | "PPR";
type Position = "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DST";

type EcrRow = {
  player_id: number;
  player_name: string;
  player_short_name: string;
  player_positions: string;
  player_filename?: string | null;
  player_team_id: string | null;
  player_bye_week?: string | number | null;
  rank_ecr: number | null;
  rank_min: number | null;
  rank_max: number | null;
  rank_ave: number | null;
  rank_std: number | null;
  player_owned_avg: number | null;
  pos_rank: string | null;
  tier: number | null;
  start_sit_grade?: string | null;
  player_page_url?: string | null;
};

type RawJson<T> = { meta: any; rows: T[] };

async function readJson<T>(file: string): Promise<T> {
  const txt = await fs.readFile(file, "utf8");
  return JSON.parse(txt) as T;
}

async function collectProjections(scoring: Scoring): Promise<Map<string, any>> {
  const dir = path.resolve("public", "data", "fantasypros", "raw");
  if (!require("node:fs").existsSync(dir)) {
    throw new Error(
      `FantasyPros raw directory missing: ${dir}.\n` +
        `Fetch first with: pnpm run fetch:fp`
    );
  }
  const result = new Map<string, any>();
  const positions: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"]; // FLEX not needed
  for (const pos of positions) {
    const file = path.join(
      dir,
      `${pos}-${scoring.toLowerCase()}-draft_raw.json`
    );
    try {
      const raw = await readJson<RawJson<Record<string, string>>>(file);
      for (const row of raw.rows) {
        const filename = (row["PlayerFilename"] || "").trim();
        const normKey = `${(row["Player"] || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")}|${(row["Team"] || "").toLowerCase()}`;
        const assignInto = (key: string) => {
          const existing = result.get(key) ?? {};
          existing[`stats_${scoring}`] = existing[`stats_${scoring}`] ?? {};
          existing[`stats_${scoring}`][pos] = row;
          result.set(key, existing);
        };
        // always store by normalized key
        assignInto(normKey);
        // also store by filename when available
        if (filename) assignInto(filename);
      }
    } catch {
      // ignore missing files
    }
  }
  return result;
}

async function collectEcr(scoring: Scoring): Promise<{
  byId: Map<number, EcrRow>;
  byKey: Map<string, EcrRow>;
  byName: Map<string, EcrRow>;
}> {
  const dir = path.resolve("public", "data", "fantasypros", "raw");
  const draftFile = path.join(
    dir,
    `ECR-ADP-${scoring.toLowerCase()}-draft_raw.json`
  );
  const byId = new Map<number, EcrRow>();
  const byKey = new Map<string, EcrRow>();
  const byName = new Map<string, EcrRow>();
  const better = (prev?: EcrRow, next?: EcrRow): boolean => {
    if (!prev) return true;
    if (!next) return false;
    const prevIsFlex =
      /(^|,)\s*FLX\s*(,|$)/.test(prev.player_positions || "") ||
      (prev as any).player_position_id === "FLX";
    const nextIsFlex =
      /(^|,)\s*FLX\s*(,|$)/.test(next.player_positions || "") ||
      (next as any).player_position_id === "FLX";
    // Prefer non-FLEX over FLEX
    if (prevIsFlex && !nextIsFlex) return true;
    if (!prevIsFlex && nextIsFlex) return false;
    // Prefer row that has a start_sit_grade
    const prevGrade = (prev as any).start_sit_grade ?? null;
    const nextGrade = (next as any).start_sit_grade ?? null;
    if (!prevGrade && nextGrade) return true;
    if (prevGrade && !nextGrade) return false;
    // Otherwise keep existing
    return false;
  };
  const ingest = (rows: EcrRow[]) => {
    for (const row of rows) {
      const existingById = byId.get(row.player_id);
      if (better(existingById, row)) byId.set(row.player_id, row);
      const nameOnly = (row.player_name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const key = `${nameOnly}|${(row.player_team_id || "").toLowerCase()}`;
      const existingByKey = byKey.get(key);
      if (better(existingByKey, row)) byKey.set(key, row);
      const existingByName = byName.get(nameOnly);
      if (better(existingByName, row)) byName.set(nameOnly, row);
    }
  };
  // Prefer weekly files if present (across supported positions)
  const weeklyGlobs = [
    `ECR-weekly-${scoring.toLowerCase()}-rb-week-*_raw.json`,
    `ECR-weekly-${scoring.toLowerCase()}-wr-week-*_raw.json`,
    `ECR-weekly-${scoring.toLowerCase()}-te-week-*_raw.json`,
    `ECR-weekly-${scoring.toLowerCase()}-flex-week-*_raw.json`,
    `ECR-weekly-std-qb-week-*_raw.json`,
    `ECR-weekly-std-k-week-*_raw.json`,
    `ECR-weekly-std-dst-week-*_raw.json`,
  ];
  let weeklyFound = false;
  try {
    const files = require("glob").sync(`{${weeklyGlobs.join(",")}}`, {
      cwd: dir,
      nodir: true,
      absolute: true,
    });
    for (const f of files) {
      try {
        const raw = await readJson<RawJson<EcrRow>>(f);
        if (Array.isArray(raw?.rows) && raw.rows.length) {
          ingest(raw.rows);
          weeklyFound = true;
        }
      } catch {
        // ignore
      }
    }
  } catch {}

  if (!weeklyFound) {
    try {
      const raw = await readJson<RawJson<EcrRow>>(draftFile);
      if (Array.isArray(raw?.rows)) ingest(raw.rows);
    } catch {
      // ignore
    }
  }
  return { byId, byKey, byName };
}

async function main() {
  const outDir = path.resolve("public", "data", "fantasypros");
  const scorings: Scoring[] = ["STD", "HALF", "PPR"];

  // Build indices
  const perScoringProjections = await Promise.all(
    scorings.map((s) => collectProjections(s))
  );
  const perScoringEcr = await Promise.all(scorings.map((s) => collectEcr(s)));

  // Merge by filename when possible; also attach ecr by matching player name/team if available via ECR rows
  const aggregate: any[] = [];
  const keys = new Set<string>();
  // Keys from projections (if present)
  for (const map of perScoringProjections) {
    for (const key of map.keys()) keys.add(key);
  }
  // Also include keys from ECR (normalized name|team) so we can build entries even without projections
  for (const ecr of perScoringEcr) {
    for (const key of ecr.byKey.keys()) keys.add(key);
  }

  const pickStatsRow = (bucket: any, primaryPos?: string) => {
    if (!bucket) return null;
    if (primaryPos && bucket[primaryPos as Position])
      return bucket[primaryPos as Position];
    const firstKey = Object.keys(bucket)[0];
    return firstKey ? bucket[firstKey] : null;
  };

  for (const key of keys) {
    const filename = key.includes("|") ? "" : key;
    const normKey = key.includes("|") ? key : "";

    // ECR per scoring
    const ecrByScoring: Record<string, EcrRow | undefined> = {};
    scorings.forEach((s, idx) => {
      const scoringEcr = perScoringEcr[idx];
      if (!scoringEcr) return;
      const { byId, byKey, byName } = scoringEcr;
      let matched: EcrRow | undefined;
      if (filename) {
        for (const ecr of byId.values()) {
          if ((ecr.player_filename || "") === filename) {
            matched = ecr;
            break;
          }
        }
      } else if (normKey) {
        matched = byKey.get(normKey);
        // Fallback: for DST, FantasyPros may not include "Team" in projections rows; match by name only
        if (!matched && normKey.includes("|")) {
          const nameOnly = normKey.split("|")[0];
          if (nameOnly) {
            matched = byName.get(nameOnly);
          }
        }
      }
      ecrByScoring[s.toLowerCase()] = matched;
    });

    const primaryEcrCandidate =
      ecrByScoring["ppr"] || ecrByScoring["half"] || ecrByScoring["std"];
    if (!primaryEcrCandidate) continue;
    const primaryPos = (primaryEcrCandidate.player_positions || "").split(
      /\s*,\s*/
    )[0] as Position | undefined;

    const stats: any = {};
    scorings.forEach((s, idx) => {
      const map = perScoringProjections[idx];
      if (!map) return;
      const bucket = map.get(key)?.[`stats_${s}`];
      const row = pickStatsRow(bucket, primaryPos);
      if (row) {
        const { Player, Team, PlayerFilename, ...rest } = row as Record<
          string,
          string
        >;
        const posUp = (primaryPos || "").toUpperCase();
        const base: Record<string, string> = { ...rest };
        // Normalize FantasyPros K/DST points keys so downstream can read FPTS_AVG/HIGH/LOW
        if (posUp === "K" || posUp === "DST") {
          const avg = (row as any)["FPTS_FPTS_AVG"] ?? (row as any)["FPTS_AVG"];
          const hi =
            (row as any)["FPTS_FPTS_HIGH"] ?? (row as any)["FPTS_HIGH"];
          const lo = (row as any)["FPTS_FPTS_LOW"] ?? (row as any)["FPTS_LOW"];
          if (avg != null) base["FPTS_AVG"] = String(avg);
          if (hi != null) base["FPTS_HIGH"] = String(hi);
          if (lo != null) base["FPTS_LOW"] = String(lo);
        }
        stats[s.toLowerCase()] = base;
      }
    });

    const shape = (e?: EcrRow) =>
      e
        ? {
            rank_ecr: e.rank_ecr,
            rank_min: e.rank_min,
            rank_max: e.rank_max,
            rank_ave: e.rank_ave,
            rank_std: e.rank_std,
            tier: e.tier,
          }
        : undefined;

    const rankings: any = {};
    const stdRank = shape(ecrByScoring["std"]);
    const halfRank = shape(ecrByScoring["half"]);
    const pprRank = shape(ecrByScoring["ppr"]);
    if (stdRank) rankings["standard"] = stdRank;
    if (halfRank) rankings["half"] = halfRank;
    if (pprRank) rankings["ppr"] = pprRank;

    const entry = {
      player_id: primaryEcrCandidate.player_id,
      player_name: primaryEcrCandidate.player_name,
      player_short_name: primaryEcrCandidate.player_short_name,
      player_positions: primaryEcrCandidate.player_positions,
      player_team_id: primaryEcrCandidate.player_team_id,
      player_bye_week: primaryEcrCandidate.player_bye_week ?? null,
      player_owned_avg: primaryEcrCandidate.player_owned_avg,
      pos_rank: primaryEcrCandidate.pos_rank,
      player_page_url: (primaryEcrCandidate as any).player_page_url ?? null,
      start_sit_grade: (primaryEcrCandidate as any).start_sit_grade ?? null,
      stats: {
        standard: stats["std"] ?? {},
        half: stats["half"] ?? {},
        ppr: stats["ppr"] ?? {},
      },
      rankings,
    };

    aggregate.push(entry);
  }

  // Optionally, we could attempt to link ECR by player name later when needed

  const outPath = path.join(outDir, `fantasypros_aggregate.json`);
  await fs.writeFile(
    outPath,
    JSON.stringify(
      { updatedAt: new Date().toISOString(), data: aggregate },
      null,
      2
    ),
    "utf8"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
