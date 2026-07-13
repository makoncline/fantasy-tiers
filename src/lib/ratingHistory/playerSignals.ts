import { z } from "zod";

const NullableNumber = z.number().nullable();
const NullableString = z.string().nullable();

export const RatingHistoryRatingSummarySchema = z.object({
  source: z.string(),
  mode: z.string(),
  season: NullableNumber,
  week: NullableNumber,
  scoring: NullableString,
  positionScope: NullableString,
  effectiveFrom: z.string(),
  effectiveTo: NullableString,
  isCurrent: z.boolean(),
  rankOverall: NullableNumber,
  rankPosition: NullableNumber,
  tier: NullableNumber,
  points: NullableNumber,
  adp: NullableNumber,
  rosterPct: NullableNumber,
  sleeperSearchRank: NullableNumber,
  sourceStatus: z.string(),
});

export const RatingHistoryPlayerSignalSchema = z.object({
  available: z.boolean(),
  reason: z.string().nullable(),
  player: z
    .object({
      playerId: z.string(),
      name: z.string(),
      position: NullableString,
      team: NullableString,
      byeWeek: NullableNumber,
    })
    .nullable(),
  current: z.record(z.string(), RatingHistoryRatingSummarySchema.nullable()),
  lastPresent: z.record(z.string(), RatingHistoryRatingSummarySchema.nullable()),
  flags: z.object({
    currentlyMissingPrimaryTier: z.boolean(),
    currentlyMissingFantasyPros: z.boolean(),
    hasDurableSleeperValue: z.boolean(),
    hasDurableFantasyProsValue: z.boolean(),
  }),
  recentTimeline: z.array(RatingHistoryRatingSummarySchema),
});

export const RatingHistoryPlayerSignalResponseSchema = z.object({
  signal: RatingHistoryPlayerSignalSchema,
});

export type RatingHistoryPlayerSignal = z.infer<
  typeof RatingHistoryPlayerSignalSchema
>;
