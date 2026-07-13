import { z } from "zod";
import { CombinedShard, type CombinedShardT } from "./schemas-aggregates";

const ScoringQuality = z.object({
  ecrRows: z.number().int().nonnegative(),
  topCandidates: z.number().int().nonnegative(),
  sleeperAdpCovered: z.number().int().nonnegative(),
  sleeperAdpCoveragePct: z.number().nonnegative(),
  tierCovered: z.number().int().nonnegative(),
  tierCoveragePct: z.number().nonnegative(),
  expertsIncluded: z.number().int().nonnegative().nullable(),
  expertsAvailable: z.number().int().nonnegative().nullable(),
  expertCoveragePct: z.number().nonnegative().nullable(),
});

const ShardCounts = z.object({
  ALL: z.number().int().nonnegative(),
  QB: z.number().int().nonnegative(),
  RB: z.number().int().nonnegative(),
  WR: z.number().int().nonnegative(),
  TE: z.number().int().nonnegative(),
  K: z.number().int().nonnegative(),
  DEF: z.number().int().nonnegative(),
  FLEX: z.number().int().nonnegative(),
});

export const DraftDataQualityReportSchema = z.object({
  version: z.literal(1),
  mode: z.string().min(1),
  season: z.string().min(1),
  generatedAt: z.string().datetime(),
  status: z.enum(["healthy", "blocked"]),
  shards: ShardCounts,
  scoring: z.object({
    std: ScoringQuality,
    half: ScoringQuality,
    ppr: ScoringQuality,
  }),
  sources: z.object({
    fantasyprosUpdatedAt: z.string().datetime().nullable(),
    sleeperUpdatedAt: z.string().datetime().nullable(),
    tiersUpdatedAt: z.string().datetime().nullable(),
  }),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

export type DraftDataQualityReport = z.infer<
  typeof DraftDataQualityReportSchema
>;

const SCORING = {
  std: { fp: "standard", adp: "adp_std" },
  half: { fp: "half", adp: "adp_half_ppr" },
  ppr: { fp: "ppr", adp: "adp_ppr" },
} as const;

export const DraftQualityMetadataSchema = z.object({
  expert_samples: z
    .record(
      z.string(),
      z.object({
        included: z.number().int().nonnegative().nullable().optional(),
        available: z.number().int().nonnegative().nullable().optional(),
        coverage_pct: z.number().nonnegative().nullable().optional(),
        last_updated: z.string().nullable().optional(),
      })
    )
    .optional(),
  tiers: z
    .record(
      z.string(),
      z.record(
        z.string(),
        z.object({ last_updated: z.string().nullable().optional() })
      )
    )
    .optional(),
});

type AggregateMetadata = z.infer<typeof DraftQualityMetadataSchema>;

type BuildQualityInput = {
  mode: string;
  season: string;
  generatedAt: Date;
  shards: Record<string, unknown>;
  metadata: AggregateMetadata;
  previous?: DraftDataQualityReport | null;
};

const TOP_CANDIDATES = 180;
const MIN_ECR_ROWS = 300;
const MIN_TOP_ADP = 150;
const MIN_TOP_TIERS = 160;
const MAX_SOURCE_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const RankAverageSchema = z.object({ rank_ave: z.number().finite() });

function rankAverage(
  player: CombinedShardT[string],
  scoring: string
): number | null {
  const result = RankAverageSchema.safeParse(
    player.fantasypros?.rankings[scoring]
  );
  return result.success ? result.data.rank_ave : null;
}

function newestIso(values: Array<unknown>): string | null {
  const timestamps = values
    .map((value) => {
      if (typeof value === "number") return new Date(value).getTime();
      if (typeof value === "string" && /^\d+$/.test(value)) {
        return new Date(Number(value)).getTime();
      }
      return new Date(String(value)).getTime();
    })
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Number(((count / total) * 100).toFixed(1));
}

function isFresh(value: string | null, now: Date): boolean {
  if (value === null) return false;
  return now.getTime() - new Date(value).getTime() <= MAX_SOURCE_AGE_MS;
}

export function buildDraftDataQualityReport(
  input: BuildQualityInput
): DraftDataQualityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (input.mode !== "draft") errors.push(`Pipeline mode is ${input.mode}, expected draft`);
  if (input.season !== "2026") errors.push(`Pipeline season is ${input.season}, expected 2026`);

  const parsedShards = Object.fromEntries(
    Object.entries(input.shards).map(([position, value]) => [
      position,
      CombinedShard.parse(value),
    ])
  ) as Record<string, CombinedShardT>;
  const shardCounts = ShardCounts.parse(
    Object.fromEntries(
      Object.entries(parsedShards).map(([position, shard]) => [
        position,
        Object.keys(shard).length,
      ])
    )
  );
  for (const [position, count] of Object.entries(shardCounts)) {
    if (count === 0) errors.push(`${position} shard is empty`);
  }

  const allPlayers = Object.values(parsedShards.ALL ?? {});
  const scoring = Object.fromEntries(
    Object.entries(SCORING).map(([scoringKey, fields]) => {
      const candidates = allPlayers
        .filter((player) => rankAverage(player, fields.fp) !== null)
        .sort(
          (a, b) =>
            (rankAverage(a, fields.fp) ?? Infinity) -
            (rankAverage(b, fields.fp) ?? Infinity)
        );
      const top = candidates.slice(0, TOP_CANDIDATES);
      const sleeperAdpCovered = top.filter((player) => {
        const value = player.sleeper.stats[fields.adp];
        return value > 0 && value < 999;
      }).length;
      const tierCovered = top.filter(
        (player) => player.tiers[scoringKey as keyof typeof player.tiers] !== null
      ).length;
      const sample = input.metadata.expert_samples?.[
        `fantasypros:${scoringKey.toUpperCase()}:draft`
      ];
      const result = {
        ecrRows: candidates.length,
        topCandidates: top.length,
        sleeperAdpCovered,
        sleeperAdpCoveragePct: percentage(sleeperAdpCovered, top.length),
        tierCovered,
        tierCoveragePct: percentage(tierCovered, top.length),
        expertsIncluded: sample?.included ?? null,
        expertsAvailable: sample?.available ?? null,
        expertCoveragePct: sample?.coverage_pct ?? null,
      };

      if (result.ecrRows < MIN_ECR_ROWS) errors.push(`${scoringKey} ECR has only ${result.ecrRows} ranked players`);
      if (result.topCandidates < TOP_CANDIDATES) errors.push(`${scoringKey} has only ${result.topCandidates} top candidates`);
      if (result.sleeperAdpCovered < MIN_TOP_ADP) errors.push(`${scoringKey} top-${TOP_CANDIDATES} Sleeper ADP covers only ${result.sleeperAdpCovered}`);
      if (result.tierCovered < MIN_TOP_TIERS) errors.push(`${scoringKey} top-${TOP_CANDIDATES} tiers cover only ${result.tierCovered}`);
      if ((result.expertsIncluded ?? 0) < 10) warnings.push(`${scoringKey} FantasyPros expert sample is thin (${result.expertsIncluded ?? 0})`);

      const prior = input.previous?.scoring[scoringKey as keyof typeof input.previous.scoring];
      if (prior && result.ecrRows < prior.ecrRows * 0.7) errors.push(`${scoringKey} ECR coverage regressed more than 30%`);
      if (prior && result.sleeperAdpCovered < prior.sleeperAdpCovered * 0.8) errors.push(`${scoringKey} Sleeper ADP coverage regressed more than 20%`);
      if (prior && result.tierCovered < prior.tierCovered * 0.8) errors.push(`${scoringKey} tier coverage regressed more than 20%`);
      return [scoringKey, result];
    })
  );

  const fantasyprosUpdatedAt = newestIso(
    Object.values(input.metadata.expert_samples ?? {}).map((sample) => sample.last_updated)
  );
  const sleeperUpdatedAt = newestIso(allPlayers.map((player) => player.sleeper.updated_at));
  const tiersUpdatedAt = newestIso(
    Object.values(input.metadata.tiers ?? {}).flatMap((positions) =>
      Object.values(positions).map((position) => position.last_updated)
    )
  );
  for (const [source, value] of Object.entries({
    FantasyPros: fantasyprosUpdatedAt,
    Sleeper: sleeperUpdatedAt,
    Tiers: tiersUpdatedAt,
  })) {
    if (!isFresh(value, input.generatedAt)) errors.push(`${source} source data is missing or older than seven days`);
  }

  return DraftDataQualityReportSchema.parse({
    version: 1,
    mode: input.mode,
    season: input.season,
    generatedAt: input.generatedAt.toISOString(),
    status: errors.length === 0 ? "healthy" : "blocked",
    shards: shardCounts,
    scoring,
    sources: { fantasyprosUpdatedAt, sleeperUpdatedAt, tiersUpdatedAt },
    warnings,
    errors,
  });
}
