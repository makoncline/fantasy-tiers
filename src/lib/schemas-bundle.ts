// src/lib/schemas-bundle.ts
import { z } from "zod";
import { scoringTypeSchema } from "./schemas";

// Individual player shape in the bundle response
export const AggregatesBundlePlayer = z.object({
  player_id: z.string(),
  name: z.string(),
  position: z.string(),
  team: z.string().nullable(),
  bye_week: z.number().nullable(),
  borischen: z.object({
    rank: z.number().nullable(),
    tier: z.number().nullable(),
  }),
  sleeper: z.object({
    rank: z.number().nullable(),
    adp: z.number().nullable(),
    pts: z.number().nullable(),
  }),
  fantasypros: z.object({
    rank: z.number().nullable(),
    tier: z.number().nullable(),
    pos_rank: z.string().nullable(),
    ecr: z.number().nullable(),
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

export type RosterSlotsT = z.infer<typeof RosterSlotsSchema>;

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

export type AggregatesBundleShardsT = z.infer<typeof AggregatesBundleShards>;

// Full response schema
export const AggregatesBundleResponse = z.object({
  lastModified: z.number().nullable(),
  scoring: scoringTypeSchema,
  teams: z.number(),
  roster: RosterSlotsSchema,
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
});

export type AggregatesBundleQueryParamsT = z.infer<
  typeof AggregatesBundleQueryParams
>;
