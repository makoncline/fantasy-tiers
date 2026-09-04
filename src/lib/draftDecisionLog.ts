import { z } from "zod";

import {
  DraftRosterSlotsSchema,
  DraftScoringRulesSchema,
} from "@/lib/draftLeagueConfig";
import { PositionEnum } from "@/lib/schemas";
import type { AggregatesBundleResponseT } from "@/lib/schemas-bundle";
import { SIM_BOT_STRATEGY_IDS } from "@/lib/simDraft/botStrategies";
import type { SimDraftPlayer } from "@/lib/simDraft";

export const DRAFT_DECISION_LOG_SCHEMA_VERSION = 1;

const nullableNumber = z.number().finite().nullable();

export const AlgorithmDraftCandidateSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  position: PositionEnum,
  team: z.string().nullable(),
  byeWeek: z.number().int().nullable(),
  recommendationRank: z.number().int().min(1),
  recommendationScore: z.number().finite(),
  recommendationEdge: z.enum([
    "Coin flip",
    "Slight edge",
    "Clear edge",
    "Big edge",
    "Only option",
  ]),
  recommendationEdgeDetail: z.string(),
  recommendationPros: z.array(z.string()),
  recommendationCons: z.array(z.string()),
  dataQualityNotes: z.array(z.string()),
  recommendationSummary: z.string(),
  confidence: z.enum(["high", "medium", "low"]).nullable(),
  scoreGap: nullableNumber,
  staticValue: nullableNumber,
  valueRank: z.number().int().min(1).nullable(),
  positionalValueRank: z.number().int().min(1).nullable(),
  positionTier: z.number().int().min(1).nullable(),
  comebackProbability: nullableNumber,
  comebackLabel: z.enum(["likely", "toss-up", "unlikely", "unknown"]),
  weightProfile: z.enum([
    "starter_build",
    "core_balance",
    "depth_build",
    "endgame",
  ]),
  topComponents: z.array(z.object({
    key: z.enum([
      "value",
      "timing",
      "starterNeed",
      "construction",
      "onesie",
      "depth",
      "demand",
      "risk",
    ]),
    label: z.string(),
    value: z.number().finite(),
  })),
  reasonLabels: z.array(z.string()),
  reasonDetails: z.array(z.string()),
});

export const AlgorithmDraftDecisionSchema = z.object({
  pickNo: z.number().int().min(1),
  round: z.number().int().min(1),
  pickInRound: z.number().int().min(1),
  userSlot: z.number().int().min(1),
  selected: AlgorithmDraftCandidateSchema,
  topOptions: z.array(AlgorithmDraftCandidateSchema),
  challengers: z.array(z.object({
    playerId: z.string().min(1),
    score: z.number().finite(),
    scoreGap: z.number().finite(),
  })),
  rosterCountsBefore: z.record(z.string(), z.number().int().min(0)),
  rosterNeedsBefore: z.record(z.string(), z.number().int().min(0)),
  availableCount: z.number().int().min(0),
});

export const DraftSourceSnapshotSchema = z.object({
  aggregateLastModified: z.number().nullable(),
  aggregateGeneratedAt: z.string().nullable(),
  projectionFetchedAt: z.string().nullable(),
  projectionSourceLastModified: z.string().nullable(),
  playerPoolSize: z.number().int().min(1),
  playerPoolSignature: z.string().regex(/^[a-f0-9]{64}$/),
});

export const DraftDecisionLogSchema = z.object({
  schemaVersion: z.literal(DRAFT_DECISION_LOG_SCHEMA_VERSION),
  generatedAt: z.string().datetime(),
  sourceSnapshot: DraftSourceSnapshotSchema,
  league: z.object({
    teams: z.number().int().min(2),
    rounds: z.number().int().min(1),
    rosterSlots: DraftRosterSlotsSchema,
    scoringRules: DraftScoringRulesSchema,
    draftType: z.enum(["snake", "linear"]),
    botStrategy: z.enum(SIM_BOT_STRATEGY_IDS),
    seed: z.string().min(1),
    slot: z.number().int().min(1),
  }),
  decisions: z.array(AlgorithmDraftDecisionSchema),
});

export type AlgorithmDraftCandidate = z.infer<
  typeof AlgorithmDraftCandidateSchema
>;
export type AlgorithmDraftDecision = z.infer<typeof AlgorithmDraftDecisionSchema>;
export type DraftDecisionLog = z.infer<typeof DraftDecisionLogSchema>;
export type DraftSourceSnapshot = z.infer<typeof DraftSourceSnapshotSchema>;

export function createDraftSourceSnapshotFromSignature(input: {
  bundle: AggregatesBundleResponseT;
  players: readonly SimDraftPlayer[];
}, playerPoolSignature: string): DraftSourceSnapshot {
  return DraftSourceSnapshotSchema.parse({
    aggregateLastModified: input.bundle.lastModified,
    aggregateGeneratedAt: input.bundle.sourceHealth?.generatedAt ?? null,
    projectionFetchedAt: input.bundle.draftProjections?.fetchedAt ?? null,
    projectionSourceLastModified:
      input.bundle.draftProjections?.sourceLastModified ?? null,
    playerPoolSize: input.players.length,
    playerPoolSignature,
  });
}

export function serializePlayerPoolIds(
  players: readonly { player_id: string }[]
) {
  return players.map((player) => player.player_id).toSorted().join("\n");
}
