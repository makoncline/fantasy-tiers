// src/lib/schemas-bundle.ts
import { z } from "zod";
import { PositionEnum, scoringTypeSchema } from "./schemas";
import { DraftProjectionArtifactSchema } from "./beerPlusStrategy";

// Individual player shape in the bundle response
export const AggregatesBundlePlayer = z.object({
  player_id: z.string(),
  name: z.string(),
  position: z.string(),
  team: z.string().nullable(),
  bye_week: z.number().nullable(),
  tiers: z.object({
    rank: z.number().nullable(),
    tier: z.number().nullable(),
  }),
  sleeper: z.object({
    rank: z.number().nullable(),
    adp: z.number().nullable(),
    boardValue: z.number().nullable(),
    pts: z.number().nullable(),
    depthChartPosition: z.string().nullable(),
    depthChartOrder: z.number().int().positive().nullable(),
    injuryStatus: z.string().nullable(),
    injuryNotes: z.string().nullable(),
  }),
  fantasypros: z.object({
    rank: z.number().nullable(),
    tier: z.number().nullable(),
    pos_rank: z.string().nullable(),
    ecr: z.number().nullable(),
    ecr_average: z.number().nullable(),
    ecr_std: z.number().nullable(),
    ecr_round_pick: z.string().nullable(),
    pts: z.number().nullable(),
    baseline_pts: z.number().nullable(),
    adp: z.number().nullable(),
    player_owned_avg: z.number().nullable(),
  }),
  calc: z.object({
    value: z.number().nullable(),
    positional_scarcity: z.number().nullable(),
    market_delta: z.number().nullable(),
  }),
});

export type AggregatesBundlePlayerT = z.infer<typeof AggregatesBundlePlayer>;

export const AggregateSourceHealthItem = z.object({
  source: z.enum(["Sleeper", "FantasyPros"]),
  status: z.enum(["available", "missing"]),
  season: z.string().nullable(),
  lastUpdated: z.string().nullable(),
  fetchedAt: z.string().nullable(),
  rowCount: z.number().nullable(),
  expertsIncluded: z.number().int().nonnegative().nullable(),
  expertsAvailable: z.number().int().nonnegative().nullable(),
  expertCoveragePct: z.number().nonnegative().nullable(),
  problems: z.array(z.string()),
});

export const AggregateSourceHealth = z.object({
  generatedAt: z.string(),
  scoring: scoringTypeSchema,
  sources: z.array(AggregateSourceHealthItem),
  fantasyProsPlayers: z.array(
    z.object({
      sourcePlayerId: z.string().min(1),
      name: z.string().min(1),
      normalizedName: z.string().min(1),
      position: PositionEnum,
      rankAve: z.number().finite(),
      rankPos: z.number().finite().nullable(),
      updatedAt: z.string().datetime().nullable(),
    })
  ),
  sleeperPlayers: z.array(
    z.object({
      playerId: z.string().min(1),
      name: z.string().min(1),
      normalizedName: z.string().min(1),
      position: PositionEnum,
      marketRank: z.number().int().positive(),
    })
  ),
});
export type AggregateSourceHealthT = z.infer<typeof AggregateSourceHealth>;

// Roster slots schema
export const RosterSlotsSchema = z.object({
  QB: z.number(),
  RB: z.number(),
  WR: z.number(),
  TE: z.number(),
  K: z.number(),
  DEF: z.number(),
  FLEX: z.number(),
  BENCH: z.number(),
});

// Shards schema
export const AggregatesBundleShards = z.object({
  ALL: z.array(AggregatesBundlePlayer),
  QB: z.array(AggregatesBundlePlayer),
  RB: z.array(AggregatesBundlePlayer),
  WR: z.array(AggregatesBundlePlayer),
  TE: z.array(AggregatesBundlePlayer),
  K: z.array(AggregatesBundlePlayer),
  DEF: z.array(AggregatesBundlePlayer),
  FLEX: z.array(AggregatesBundlePlayer),
});

// Full response schema
export const AggregatesBundleResponse = z.object({
  lastModified: z.number().nullable(),
  scoring: scoringTypeSchema,
  teams: z.number(),
  roster: RosterSlotsSchema,
  sourceHealth: AggregateSourceHealth.optional(),
  draftProjections: DraftProjectionArtifactSchema.nullable().default(null),
  shards: AggregatesBundleShards,
});

export type AggregatesBundleResponseT = z.infer<
  typeof AggregatesBundleResponse
>;

// Query parameters schema for validation
export const AggregatesBundleQueryParams = z.object({
  scoring: scoringTypeSchema,
  teams: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val <= 20, "teams must be between 1 and 20"),
  slots_qb: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  slots_rb: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  slots_wr: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  slots_te: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  slots_k: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  slots_def: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  slots_flex: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  slots_bench: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
});
