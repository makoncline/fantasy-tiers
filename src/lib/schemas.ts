import { z } from "zod";

export const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
export const PositionEnum = z.enum(POSITIONS);
export type Position = z.infer<typeof PositionEnum>;

export const ROSTER_SLOTS = [...POSITIONS, "FLEX", "BN"] as const;
export const RosterSlotEnum = z.enum(ROSTER_SLOTS);
export type RosterSlot = z.infer<typeof RosterSlotEnum>;

export const DraftPickSchema = z.object({
  draft_slot: z.number(),
  round: z.number(),
  pick_no: z.number(),
  player_id: z.string(),
});

export type DraftPick = z.infer<typeof DraftPickSchema>;

// Schema for rank and tier data only
export const RankTierSchema = z.object({
  rank: z.number(),
  tier: z.number(),
});

// Schema for the rankings by scoring type
const RankingsByScoringTypeSchema = z.object({
  std: RankTierSchema.nullable(),
  ppr: RankTierSchema.nullable(),
  half: RankTierSchema.nullable(),
});

// Schema for the final player data
export const PlayerSchema = z.object({
  player_id: z.string(),
  name: z.string(),
  position: PositionEnum,
  team: z.string().nullable(),
  bye_week: z.string().nullable(),
});

export const PlayerWithRankingsSchema = PlayerSchema.extend({
  rankingsByScoringType: RankingsByScoringTypeSchema,
});
export type PlayerWithRankings = z.infer<typeof PlayerWithRankingsSchema>;

export const SCORING_TYPES = ["std", "ppr", "half"] as const;
export const scoringTypeSchema = z.enum(SCORING_TYPES);
export type ScoringType = z.infer<typeof scoringTypeSchema>;

export const DraftedPlayerSchema = PlayerSchema.extend({
  rank: z.number().nullable(),
  tier: z.number().nullable(),
});

// Ranked player schema with non-nullable rank and tier
export const RankedPlayerSchema = PlayerSchema.extend({
  rank: z.number(),
  tier: z.number(),
});

export type DraftedPlayer = z.infer<typeof DraftedPlayerSchema>;
export type RankedPlayer = z.infer<typeof RankedPlayerSchema>;
