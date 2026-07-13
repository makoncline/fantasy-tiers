import { z } from "zod";

import { createMockDraftResultArtifact } from "@/lib/draftResults";
import { DraftPicksSchema, PositionEnum, scoringTypeSchema } from "@/lib/schemas";
import {
  createDefaultSimDraftConfig,
  getSimDraftSnapshot,
  toSleeperDraftDetails,
  type SimDraftPlayer,
  type SimDraftState,
} from "@/lib/simDraft";

const SleeperPickMetadataSchema = z.object({
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  position: PositionEnum,
  team: z.string().optional().default(""),
});

const RawSleeperPickSchema = z.object({
  draft_id: z.string().optional(),
  draft_slot: z.number().int().min(1),
  round: z.number().int().min(1),
  pick_no: z.number().int().min(1),
  player_id: z.string().min(1),
  metadata: SleeperPickMetadataSchema,
});

export const RawSleeperDraftBoardSchema = z.array(RawSleeperPickSchema);

export const SleeperDraftImportOptionsSchema = z.object({
  userSlot: z.number().int().min(1),
  scoring: scoringTypeSchema.default("ppr"),
  leagueName: z.string().min(1).default("Imported Sleeper Draft"),
  season: z.string().min(1).default("2026"),
  userId: z.string().min(1).default("imported-user"),
  rosterSlots: z
    .object({
      QB: z.number().int().min(0),
      RB: z.number().int().min(0),
      WR: z.number().int().min(0),
      TE: z.number().int().min(0),
      K: z.number().int().min(0),
      DEF: z.number().int().min(0),
      FLEX: z.number().int().min(0),
    })
    .default({ QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, FLEX: 1 }),
  exportedAt: z.string().datetime().optional(),
});

export type SleeperDraftImportOptions = z.input<
  typeof SleeperDraftImportOptionsSchema
>;

export function importSleeperDraftBoard(
  raw: unknown,
  options: SleeperDraftImportOptions
) {
  const rawPicks = RawSleeperDraftBoardSchema.parse(raw);
  if (rawPicks.length === 0) throw new Error("Sleeper draft board is empty");
  const settings = SleeperDraftImportOptionsSchema.parse(options);
  const picks = DraftPicksSchema.parse(rawPicks).sort(
    (a, b) => a.pick_no - b.pick_no
  );
  assertCompleteSequence(picks.map((pick) => pick.pick_no));

  const teams = Math.max(...picks.map((pick) => pick.draft_slot));
  const rounds = Math.max(...picks.map((pick) => pick.round));
  if (settings.userSlot > teams) {
    throw new Error(`User slot ${settings.userSlot} exceeds ${teams} teams`);
  }
  const draftId = rawPicks.find((pick) => pick.draft_id)?.draft_id ?? "sleeper-import";
  const players = rawPicks.map(rawPickToPlayer);
  const config = createDefaultSimDraftConfig({
    draftId,
    teams,
    rounds,
    userSlot: settings.userSlot,
    userId: settings.userId,
    season: settings.season,
    leagueName: settings.leagueName,
    scoring: settings.scoring,
    rosterSlots: settings.rosterSlots,
    seed: `sleeper-import-${draftId}`,
    botStrategy: "sleeper-market-v1",
  });
  const state: SimDraftState = {
    config,
    status: picks.length === teams * rounds ? "complete" : "drafting",
    picks,
    events: rawPicks.map((pick) => ({
      pickNo: pick.pick_no,
      draftSlot: pick.draft_slot,
      playerId: pick.player_id,
      playerName: playerName(pick),
      position: pick.metadata.position,
      actor: pick.draft_slot === settings.userSlot ? "user" : "bot",
      note: "Imported from Sleeper draft board",
    })),
  };
  const snapshot = getSimDraftSnapshot(state, players);
  return createMockDraftResultArtifact({
    state,
    snapshot,
    players,
    draftDetails: toSleeperDraftDetails(state),
    draftPicks: picks,
    source: "sleeper-live",
    exportedAt: settings.exportedAt,
    notes: ["Converted from raw Sleeper draft picks."],
  });
}

function rawPickToPlayer(pick: z.infer<typeof RawSleeperPickSchema>): SimDraftPlayer {
  return {
    player_id: pick.player_id,
    name: playerName(pick),
    position: pick.metadata.position,
    team: pick.metadata.team || null,
    bye_week: null,
    rank: null,
    tier: null,
  };
}

function playerName(pick: z.infer<typeof RawSleeperPickSchema>) {
  const name = `${pick.metadata.first_name} ${pick.metadata.last_name}`.trim();
  return name || pick.metadata.team || pick.player_id;
}

function assertCompleteSequence(pickNumbers: readonly number[]) {
  const seen = new Set<number>();
  for (let index = 0; index < pickNumbers.length; index += 1) {
    const pickNo = pickNumbers[index];
    if (pickNo !== index + 1 || seen.has(pickNo)) {
      throw new Error("Sleeper picks must be a unique, continuous sequence from pick 1");
    }
    seen.add(pickNo);
  }
}
