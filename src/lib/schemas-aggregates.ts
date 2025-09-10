// src/lib/schemas-aggregates.ts
import { z } from "zod";
import { PositionEnum } from "./schemas";

export const RankTier = z.object({
  rank: z.number(),
  tier: z.number(),
});

export const RankTiersByScoring = z
  .object({
    std: RankTier.nullable(),
    ppr: RankTier.nullable(),
    half: RankTier.nullable(),
  })
  .strict();

export const SleeperStatsSubset = z
  .object({
    adp_std: z.number(),
    adp_half_ppr: z.number(),
    adp_ppr: z.number(),
    pts_std: z.number().optional(),
    pts_half_ppr: z.number().optional(),
    pts_ppr: z.number().optional(),
  })
  .strict(); // Ensure no unexpected keys

export const SleeperCombined = z.object({
  stats: SleeperStatsSubset, // required object; keys optional
  week: z.union([z.number(), z.null()]),
  player: z.object({
    injury_body_part: z.union([z.string(), z.null()]),
    injury_notes: z.union([z.string(), z.null()]),
    injury_start_date: z.union([z.string(), z.null()]),
    injury_status: z.union([z.string(), z.null()]),
  }),
  updated_at: z.union([z.number(), z.string(), z.null()]),
});

// FantasyPros stats by scoring type - flexible structure allowing any stat fields
const FantasyProsStatsByScoring = z.object({
  standard: z.record(z.string(), z.union([z.string(), z.number()])), // TESTED: Can be required - always present in data
  ppr: z.record(z.string(), z.union([z.string(), z.number()])), // TESTED: Can be required - always present in data
  half: z.record(z.string(), z.union([z.string(), z.number()])), // TESTED: Can be required - always present in data
});

export const FantasyProsCombined = z.object({
  player_id: z.string().min(1), // Require non-empty player_id
  player_owned_avg: z.union([z.number(), z.null()]),
  pos_rank: z.union([z.string(), z.number(), z.null()]),
  start_sit_grade: z.union([z.string(), z.null()]).optional(),
  stats: FantasyProsStatsByScoring,
  rankings: z.record(z.string(), z.unknown()),
});

export const CombinedEntry = z.object({
  player_id: z.string(),
  name: z.string(),
  position: PositionEnum, // Required PositionEnum for fantasy positions only
  team: z.union([z.string(), z.null()]), // nullable: observed in RB data
  bye_week: z.number().nullable(), // nullable: observed in RB data
  borischen: RankTiersByScoring,
  sleeper: SleeperCombined,
  fantasypros: z.union([FantasyProsCombined, z.null()]), // nullable: observed in RB data
});

export const CombinedShard = z.record(z.string(), CombinedEntry);
export type CombinedEntryT = z.infer<typeof CombinedEntry>;
export type CombinedShardT = z.infer<typeof CombinedShard>;
