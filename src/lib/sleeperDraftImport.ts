import { z } from "zod";

import { DraftDetailsSchema } from "@/lib/draftDetails";
import { createMockDraftResultArtifact } from "@/lib/draftResults";
import { DraftPicksSchema, PositionEnum, scoringTypeSchema } from "@/lib/schemas";
import {
  DEFAULT_DRAFT_ROSTER_SLOTS,
  DEFAULT_DRAFT_SCORING_RULES,
  DraftRosterSlotsSchema,
  draftLeagueConfigFromSleeperDraft,
} from "@/lib/draftLeagueConfig";
import { SleeperLeagueSchema } from "@/lib/sleeper";
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

export const SleeperDraftImportOptionsSchema = z
  .object({
    userSlot: z.number().int().min(1),
    scoring: scoringTypeSchema.default("ppr"),
    leagueName: z.string().min(1).default("Imported Sleeper Draft"),
    season: z.string().min(1).default("2026"),
    userId: z.string().min(1).default("imported-user"),
    rosterSlots: DraftRosterSlotsSchema.default(DEFAULT_DRAFT_ROSTER_SLOTS),
    draftDetails: DraftDetailsSchema.optional(),
    league: SleeperLeagueSchema.optional(),
    exportedAt: z.string().datetime().optional(),
  })
  .superRefine((settings, context) => {
    if ((settings.draftDetails == null) !== (settings.league == null)) {
      context.addIssue({
        code: "custom",
        message: "Verified live imports require both draft details and league settings.",
        path: [settings.draftDetails == null ? "draftDetails" : "league"],
      });
    }
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

  const importedTeams = Math.max(...picks.map((pick) => pick.draft_slot));
  const importedRounds = Math.max(...picks.map((pick) => pick.round));
  const liveConfig = settings.draftDetails && settings.league
    ? verifiedLiveConfig(settings.draftDetails, settings.league, settings.userSlot)
    : null;
  const teams = liveConfig?.teams ?? importedTeams;
  const rounds = liveConfig?.rounds ?? importedRounds;
  if (settings.userSlot > teams) {
    throw new Error(`User slot ${settings.userSlot} exceeds ${teams} teams`);
  }
  if (importedTeams > teams || importedRounds > rounds) {
    throw new Error("Sleeper picks exceed the verified live draft configuration");
  }
  const draftId = liveConfig?.draftId ??
    rawPicks.find((pick) => pick.draft_id)?.draft_id ??
    "sleeper-import";
  const players = rawPicks.map(rawPickToPlayer);
  const starterCount =
    (liveConfig?.rosterSlots.QB ?? settings.rosterSlots.QB) +
    (liveConfig?.rosterSlots.RB ?? settings.rosterSlots.RB) +
    (liveConfig?.rosterSlots.WR ?? settings.rosterSlots.WR) +
    (liveConfig?.rosterSlots.TE ?? settings.rosterSlots.TE) +
    (liveConfig?.rosterSlots.K ?? settings.rosterSlots.K) +
    (liveConfig?.rosterSlots.DEF ?? settings.rosterSlots.DEF) +
    (liveConfig?.rosterSlots.FLEX ?? settings.rosterSlots.FLEX);
  if (starterCount > rounds) {
    throw new Error(
      `Roster starters (${starterCount}) exceed imported draft rounds (${rounds})`
    );
  }
  const rosterSlots = liveConfig?.rosterSlots ?? {
    ...settings.rosterSlots,
    BENCH: rounds - starterCount,
  };
  const reception = settings.scoring === "ppr" ? 1 : settings.scoring === "half" ? 0.5 : 0;
  const config = createDefaultSimDraftConfig({
    draftId,
    teams,
    userSlot: settings.userSlot,
    userId: liveConfig?.userId ?? settings.userId,
    season: liveConfig?.season ?? settings.season,
    leagueName: liveConfig?.leagueName ?? settings.leagueName,
    pickTimerSeconds: liveConfig?.pickTimerSeconds ?? 60,
    scoringRules: liveConfig?.scoringRules ?? {
      ...DEFAULT_DRAFT_SCORING_RULES,
      reception,
    },
    rosterSlots,
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
    draftDetails: settings.draftDetails ?? toSleeperDraftDetails(state),
    draftPicks: picks,
    source: liveConfig ? "sleeper-live" : "sleeper-picks-import",
    exportedAt: settings.exportedAt,
    notes: [
      liveConfig
        ? "Converted from Sleeper picks with verified live draft and league settings."
        : "Converted from raw Sleeper draft picks without verified league settings.",
    ],
  });
}

function verifiedLiveConfig(
  draftDetails: z.infer<typeof DraftDetailsSchema>,
  league: z.infer<typeof SleeperLeagueSchema>,
  userSlot: number
) {
  const userId = Object.entries(draftDetails.draft_order).find(
    ([, slot]) => slot === userSlot
  )?.[0];
  if (!userId) {
    throw new Error(`Sleeper draft order has no user in slot ${userSlot}`);
  }
  const leagueConfig = draftLeagueConfigFromSleeperDraft(
    draftDetails,
    userId,
    league
  );
  if (leagueConfig.draftType !== "snake" && leagueConfig.draftType !== "linear") {
    throw new Error(`Unsupported live draft type: ${leagueConfig.draftType}`);
  }
  return {
    draftId: draftDetails.draft_id,
    teams: leagueConfig.teams,
    rounds: leagueConfig.rounds,
    userId,
    season: draftDetails.season ?? league.season ?? "2026",
    leagueName: draftDetails.metadata.name ?? league.name,
    pickTimerSeconds: leagueConfig.pickTimerSeconds ?? 60,
    scoringRules: leagueConfig.scoringRules,
    rosterSlots: leagueConfig.rosterSlots,
  };
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
