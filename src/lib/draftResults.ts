import { z } from "zod";

import { DraftDetailsSchema, type DraftDetails } from "@/lib/draftDetails";
import {
  AggregateSourceHealth,
  type AggregateSourceHealthT,
} from "@/lib/schemas-bundle";
import {
  DraftedPlayerSchema,
  DraftPicksSchema,
  PositionEnum,
  scoringTypeSchema,
  type DraftPick,
} from "@/lib/schemas";
import type {
  SimDraftPlayer,
  SimDraftSnapshot,
  SimDraftState,
} from "@/lib/simDraft";
import {
  DraftRosterSlotsSchema,
  DraftScoringRulesSchema,
  KeeperPolicySchema,
} from "@/lib/draftLeagueConfig";
import { SIM_BOT_STRATEGY_IDS } from "@/lib/simDraft/botStrategies";
import {
  DraftSourceSnapshotSchema,
  type DraftSourceSnapshot,
} from "@/lib/draftDecisionLog";
import {
  DraftReadinessReportSchema,
  type DraftReadinessReport,
} from "@/lib/draftReadiness";

export const DRAFT_RESULT_SCHEMA_VERSION = 3;

const SimDraftConfigSchema = z.object({
  draftId: z.string().min(1),
  userId: z.string().min(1),
  season: z.string().min(1),
  leagueName: z.string().min(1),
  teams: z.number().int().min(2),
  rounds: z.number().int().min(1),
  userSlot: z.number().int().min(1),
  draftOrderMode: z.literal("manual"),
  pickTimerSeconds: z.number().int().min(1),
  scoring: scoringTypeSchema,
  scoringRules: DraftScoringRulesSchema,
  keeperPolicy: KeeperPolicySchema,
  draftType: z.enum(["snake", "linear"]),
  seed: z.string().min(1),
  botStrategy: z.enum(SIM_BOT_STRATEGY_IDS),
  botStrategiesBySlot: z
    .record(z.string(), z.enum(SIM_BOT_STRATEGY_IDS))
    .default({}),
  rosterSlots: DraftRosterSlotsSchema,
});

const DraftResultPlayerSchema = DraftedPlayerSchema.extend({
  sleeperAdp: z.number().nullable().optional(),
  sleeperRank: z.number().nullable().optional(),
  sleeper_adp: z.number().nullable().optional(),
  fp_rank_ave: z.number().nullable().optional(),
  fp_rank_pos: z.number().nullable().optional(),
  position_tier_level: z.number().nullable().optional(),
  sleeper_injury_status: z.string().nullable().optional(),
  sleeper_injury_notes: z.string().nullable().optional(),
  sleeper_news_updated: z.number().nullable().optional(),
  fp_rank_updated_at: z.number().nullable().optional(),
}).passthrough();

const SimDraftEventSchema = z.object({
  pickNo: z.number().int().min(1),
  draftSlot: z.number().int().min(1),
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  position: PositionEnum,
  actor: z.enum(["user", "bot"]),
  note: z.string(),
});

const SimDraftStateArtifactSchema = z.object({
  config: SimDraftConfigSchema,
  status: z.enum(["pre_draft", "drafting", "complete"]),
  picks: DraftPicksSchema,
  events: z.array(SimDraftEventSchema),
});

const DraftResultSnapshotSchema = z.object({
  currentPickNo: z.number().int().min(1).nullable(),
  currentRound: z.number().int().min(1).nullable(),
  currentPickInRound: z.number().int().min(1).nullable(),
  onClockSlot: z.number().int().min(1).nullable(),
  isUserTurn: z.boolean(),
  availablePlayerIds: z.array(z.string()),
  rostersBySlot: z.record(z.string(), z.array(DraftResultPlayerSchema)),
});

const DraftResultSummarySchema = z.object({
  draftId: z.string().min(1),
  leagueName: z.string().min(1),
  season: z.string().min(1),
  scoring: scoringTypeSchema,
  teams: z.number().int().min(2),
  rounds: z.number().int().min(1),
  userSlot: z.number().int().min(1),
  status: z.enum(["pre_draft", "drafting", "complete"]),
  pickCount: z.number().int().min(0),
  userPickCount: z.number().int().min(0),
  userRosterPlayerIds: z.array(z.string()),
});

export const DraftResultArtifactSchema = z.object({
  schemaVersion: z.literal(DRAFT_RESULT_SCHEMA_VERSION),
  exportedAt: z.string().datetime(),
  source: z.enum(["mock-draft", "sleeper-live", "sleeper-picks-import"]),
  summary: DraftResultSummarySchema,
  state: SimDraftStateArtifactSchema,
  sleeper: z.object({
    draftDetails: DraftDetailsSchema,
    picks: DraftPicksSchema,
  }),
  snapshot: DraftResultSnapshotSchema,
  players: z.object({
    all: z.array(DraftResultPlayerSchema),
    drafted: z.array(DraftResultPlayerSchema),
    userRoster: z.array(DraftResultPlayerSchema),
    rostersBySlot: z.record(z.string(), z.array(DraftResultPlayerSchema)),
  }),
  assistant: z.object({
    viewModel: z.unknown().optional(),
    sourceHealth: AggregateSourceHealth.optional(),
    sourceSnapshot: DraftSourceSnapshotSchema.nullable(),
    readiness: DraftReadinessReportSchema.nullable(),
  }),
  notes: z.array(z.string()),
});

export const SaveDraftResultRequestSchema = z.object({
  artifact: DraftResultArtifactSchema,
});

export type DraftResultArtifact = z.infer<typeof DraftResultArtifactSchema>;
export type SaveDraftResultRequest = z.infer<typeof SaveDraftResultRequestSchema>;

export function createMockDraftResultArtifact(input: {
  state: SimDraftState;
  snapshot: SimDraftSnapshot;
  players: readonly SimDraftPlayer[];
  draftDetails: DraftDetails;
  draftPicks: readonly DraftPick[];
  viewModel?: unknown;
  sourceHealth?: AggregateSourceHealthT | undefined;
  sourceSnapshot?: DraftSourceSnapshot | null | undefined;
  readiness?: DraftReadinessReport | null | undefined;
  notes?: readonly string[] | undefined;
  exportedAt?: string | undefined;
  source?: "mock-draft" | "sleeper-live" | "sleeper-picks-import" | undefined;
}): DraftResultArtifact {
  const playersById = new Map(
    input.players.map((player) => [player.player_id, player])
  );
  const drafted = input.draftPicks
    .map((pick) => playersById.get(pick.player_id))
    .filter(isPresent);
  const userRoster = input.snapshot.rostersBySlot[input.state.config.userSlot] ?? [];
  const userRosterPlayerIds = userRoster.map((player) => player.player_id);
  const artifact = {
    schemaVersion: DRAFT_RESULT_SCHEMA_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    source: input.source ?? "mock-draft",
    summary: {
      draftId: input.state.config.draftId,
      leagueName: input.state.config.leagueName,
      season: input.state.config.season,
      scoring: input.state.config.scoring,
      teams: input.state.config.teams,
      rounds: input.state.config.rounds,
      userSlot: input.state.config.userSlot,
      status: input.state.status,
      pickCount: input.draftPicks.length,
      userPickCount: input.draftPicks.filter(
        (pick) => pick.draft_slot === input.state.config.userSlot
      ).length,
      userRosterPlayerIds,
    },
    state: input.state,
    sleeper: {
      draftDetails: input.draftDetails,
      picks: input.draftPicks,
    },
    snapshot: {
      currentPickNo: input.snapshot.currentPickNo,
      currentRound: input.snapshot.currentRound,
      currentPickInRound: input.snapshot.currentPickInRound,
      onClockSlot: input.snapshot.onClockSlot,
      isUserTurn: input.snapshot.isUserTurn,
      availablePlayerIds: input.snapshot.availablePlayerIds,
      rostersBySlot: input.snapshot.rostersBySlot,
    },
    players: {
      all: input.players,
      drafted,
      userRoster,
      rostersBySlot: input.snapshot.rostersBySlot,
    },
    assistant: {
      viewModel: input.viewModel,
      sourceHealth: input.sourceHealth,
      sourceSnapshot: input.sourceSnapshot ?? null,
      readiness: input.readiness ?? null,
    },
    notes: [...(input.notes ?? [])],
  };

  return DraftResultArtifactSchema.parse(artifact);
}

export function draftResultDirectoryName(artifact: DraftResultArtifact) {
  const stamp = artifact.exportedAt.replace(/\D/g, "").slice(0, 14);
  const draft = slugify(artifact.summary.draftId);
  return `${stamp}-${draft}-slot-${artifact.summary.userSlot}`;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "draft";
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}
