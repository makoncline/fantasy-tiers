import { createHash } from "node:crypto";

import {
  DRAFT_DECISION_LOG_SCHEMA_VERSION,
  DraftDecisionLogSchema,
  createDraftSourceSnapshotFromSignature,
  serializePlayerPoolIds,
  type AlgorithmDraftDecision,
  type DraftDecisionLog,
  type DraftSourceSnapshot,
} from "@/lib/draftDecisionLog";
import type { AggregatesBundleResponseT } from "@/lib/schemas-bundle";
import type { SimDraftConfig, SimDraftPlayer } from "@/lib/simDraft";

export function createDraftDecisionLog(input: {
  bundle: AggregatesBundleResponseT;
  config: SimDraftConfig;
  players: readonly SimDraftPlayer[];
  decisions: readonly AlgorithmDraftDecision[];
  generatedAt?: string;
}): DraftDecisionLog {
  return DraftDecisionLogSchema.parse({
    schemaVersion: DRAFT_DECISION_LOG_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceSnapshot: createDraftSourceSnapshot(input),
    league: {
      teams: input.config.teams,
      rounds: input.config.rounds,
      rosterSlots: input.config.rosterSlots,
      scoringRules: input.config.scoringRules,
      draftType: input.config.draftType,
      botStrategy: input.config.botStrategy,
      seed: input.config.seed,
      slot: input.config.userSlot,
    },
    decisions: input.decisions,
  });
}

export function createDraftSourceSnapshot(input: {
  bundle: AggregatesBundleResponseT;
  players: readonly SimDraftPlayer[];
}): DraftSourceSnapshot {
  return createDraftSourceSnapshotFromSignature(
    input,
    createPlayerPoolSignature(input.players)
  );
}

export function createPlayerPoolSignature(
  players: readonly { player_id: string }[]
) {
  return createHash("sha256")
    .update(serializePlayerPoolIds(players))
    .digest("hex");
}
