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
};

type RawJson<T> = { meta: any; rows: T[] };

async function readJson<T>(file: string): Promise<T> {
  const txt = await fs.readFile(file, "utf8");
  return JSON.parse(txt) as T;
}

async function collectProjections(scoring: Scoring): Promise<Map<string, any>> {
  const dir = path.resolve("public", "data", "rankings", "fantasypros", "raw");
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

async function collectEcr(
  scoring: Scoring
): Promise<{ byId: Map<number, EcrRow>; byKey: Map<string, EcrRow> }> {
  const dir = path.resolve("public", "data", "rankings", "fantasypros", "raw");
  const file = path.join(
    dir,
    `ECR-ADP-${scoring.toLowerCase()}-draft_raw.json`
  );
  const byId = new Map<number, EcrRow>();
  const byKey = new Map<string, EcrRow>();
  try {
    const raw = await readJson<RawJson<EcrRow>>(file);
    for (const row of raw.rows) {
      byId.set(row.player_id, row);
      const key = `${(row.player_name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}|${(
        row.player_team_id || ""
      ).toLowerCase()}`;
      byKey.set(key, row);
    }
  } catch {
    // ignore
  }
  return { byId, byKey };
}

async function main() {
  const outDir = path.resolve("public", "data", "rankings", "fantasypros");
  const scorings: Scoring[] = ["STD", "HALF", "PPR"];

  // Build indices
  const perScoringProjections = await Promise.all(
    scorings.map((s) => collectProjections(s))
  );
  const perScoringEcr = await Promise.all(scorings.map((s) => collectEcr(s)));

  // Merge by filename when possible; also attach ecr by matching player name/team if available via ECR rows
  const aggregate: any[] = [];
  const keys = new Set<string>();
  for (const map of perScoringProjections) {
    for (const key of map.keys()) keys.add(key);
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
      const { byId, byKey } = perScoringEcr[idx];
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
      }
      ecrByScoring[s.toLowerCase()] = matched;
    });

    const primaryEcr =
      ecrByScoring["std"] || ecrByScoring["half"] || ecrByScoring["ppr"];
    if (!primaryEcr) continue;
    const primaryPos = (primaryEcr.player_positions || "").split(
      /\s*,\s*/
    )[0] as Position | undefined;

    const stats: any = {};
    scorings.forEach((s, idx) => {
      const map = perScoringProjections[idx];
      const bucket = map.get(key)?.[`stats_${s}`];
      const row = pickStatsRow(bucket, primaryPos);
      if (row) {
        const { Player, Team, PlayerFilename, ...rest } = row as Record<
          string,
          string
        >;
        stats[s.toLowerCase()] = rest;
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
      player_id: primaryEcr.player_id,
      player_name: primaryEcr.player_name,
      player_short_name: primaryEcr.player_short_name,
      player_positions: primaryEcr.player_positions,
      player_team_id: primaryEcr.player_team_id,
      player_bye_week: primaryEcr.player_bye_week ?? null,
      player_owned_avg: primaryEcr.player_owned_avg,
      pos_rank: primaryEcr.pos_rank,
      stats: {
        ...(stats["std"] ? { standard: stats["std"] } : {}),
        ...(stats["half"] ? { half: stats["half"] } : {}),
        ...(stats["ppr"] ? { ppr: stats["ppr"] } : {}),
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
