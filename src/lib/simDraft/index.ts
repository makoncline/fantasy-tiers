import { DraftDetailsSchema, type DraftDetails } from "@/lib/draftDetails";
import {
  buildRosterRequirementsFromDraftSettings,
  calculateTeamNeedsAndCountsForSingleTeam,
} from "@/lib/draftHelpers";
import { DraftPickSchema, DraftPicksSchema, PositionEnum } from "@/lib/schemas";
import type {
  AggregatesBundlePlayerT,
  AggregatesBundleResponseT,
} from "@/lib/schemas-bundle";
import type {
  DraftPick,
  DraftedPlayer,
  Position,
  RosterSlot,
  ScoringType,
} from "@/lib/schemas";
import {
  type BotStrategyContext,
  getSimBotStrategy,
} from "@/lib/simDraft/botStrategies";
import type { SIM_BOT_STRATEGY_IDS } from "@/lib/simDraft/botStrategies";

const FLEX_POSITIONS = ["RB", "WR", "TE"] as const satisfies readonly Position[];
const SIM_DRAFT_ID_PREFIX = "sim-draft";

export type SimDraftType = "snake" | "linear";
export type SimBotStrategyId = (typeof SIM_BOT_STRATEGY_IDS)[number];

export type SimRosterSlots = {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
  FLEX: number;
};

export type SimDraftConfig = {
  draftId: string;
  userId: string;
  season: string;
  leagueName: string;
  teams: number;
  rounds: number;
  userSlot: number;
  scoring: ScoringType;
  draftType: SimDraftType;
  seed: string;
  botStrategy: SimBotStrategyId;
  botStrategiesBySlot: Record<string, SimBotStrategyId>;
  rosterSlots: SimRosterSlots;
};

export type SimDraftPlayer = DraftedPlayer & {
  sleeperAdp?: number | null;
  sleeperRank?: number | null;
  sleeper_adp?: number | null;
  fp_rank_ave?: number | null;
  fp_rank_pos?: number | null;
  position_tier_level?: number | null;
  fbg_rank?: number | null;
  fbg_rank_pos?: number | null;
  fbg_tier?: number | null;
};

export type SimDraftEvent = {
  pickNo: number;
  draftSlot: number;
  playerId: string;
  playerName: string;
  position: Position;
  actor: "user" | "bot";
  note: string;
};

export type SimDraftState = {
  config: SimDraftConfig;
  status: "pre_draft" | "drafting" | "complete";
  picks: DraftPick[];
  events: SimDraftEvent[];
};

export type SimDraftSnapshot = SimDraftState & {
  currentPickNo: number | null;
  currentRound: number | null;
  currentPickInRound: number | null;
  onClockSlot: number | null;
  isUserTurn: boolean;
  availablePlayerIds: string[];
  rostersBySlot: Record<number, SimDraftPlayer[]>;
};

export function createDefaultSimDraftConfig(
  overrides: Partial<SimDraftConfig> = {}
): SimDraftConfig {
  const teams = overrides.teams ?? 10;
  const rounds = overrides.rounds ?? 15;
  const userSlot = overrides.userSlot ?? Math.ceil(teams / 2);
  const seed = overrides.seed ?? "fantasy-tiers-2026";

  return {
    draftId: overrides.draftId ?? `${SIM_DRAFT_ID_PREFIX}-${seed}`,
    userId: overrides.userId ?? "sim-user",
    season: overrides.season ?? "2026",
    leagueName: overrides.leagueName ?? "Local Mock Draft",
    teams,
    rounds,
    userSlot,
    scoring: overrides.scoring ?? "std",
    draftType: overrides.draftType ?? "snake",
    seed,
    botStrategy: overrides.botStrategy ?? "sleeper-adp-needs",
    botStrategiesBySlot: overrides.botStrategiesBySlot ?? {},
    rosterSlots: overrides.rosterSlots ?? {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      K: 1,
      DEF: 1,
      FLEX: 1,
    },
  };
}

export function createSimDraft(config: SimDraftConfig): SimDraftState {
  assertValidConfig(config);
  return {
    config,
    status: "pre_draft",
    picks: [],
    events: [],
  };
}

export function startSimDraft(state: SimDraftState): SimDraftState {
  if (state.status === "complete") return state;
  return { ...state, status: "drafting" };
}

export function advanceUntilUserTurn(
  state: SimDraftState,
  players: readonly SimDraftPlayer[]
): SimDraftState {
  assertPlayerCapacity(state.config, players);
  let next = startSimDraft(state);
  while (next.status === "drafting") {
    const currentPickNo = getCurrentPickNo(next);
    if (currentPickNo == null) return { ...next, status: "complete" };
    const slot = getDraftSlotForPick(
      currentPickNo,
      next.config.teams,
      next.config.draftType
    );
    if (slot === next.config.userSlot) return next;
    const playerId = chooseBotPlayer(next, players, slot);
    next = makePick(next, playerId, players, "bot");
  }
  return next;
}

export function advanceToEnd(
  state: SimDraftState,
  players: readonly SimDraftPlayer[]
): SimDraftState {
  assertPlayerCapacity(state.config, players);
  let next = startSimDraft(state);
  while (next.status !== "complete") {
    const currentPickNo = getCurrentPickNo(next);
    if (currentPickNo == null) return { ...next, status: "complete" };
    const playerId =
      getDraftSlotForPick(currentPickNo, next.config.teams, next.config.draftType) ===
      next.config.userSlot
        ? chooseBotPlayer(next, players, next.config.userSlot)
        : chooseBotPlayer(
            next,
            players,
            getDraftSlotForPick(
              currentPickNo,
              next.config.teams,
              next.config.draftType
            )
          );
    next = makePick(next, playerId, players, "bot");
  }
  return next;
}

export function makeUserPick(
  state: SimDraftState,
  playerId: string,
  players: readonly SimDraftPlayer[]
): SimDraftState {
  const active = startSimDraft(state);
  const currentPickNo = getCurrentPickNo(active);
  if (currentPickNo == null) return { ...active, status: "complete" };

  const slot = getDraftSlotForPick(
    currentPickNo,
    active.config.teams,
    active.config.draftType
  );
  if (slot !== active.config.userSlot) {
    throw new Error("Cannot make a user pick while another slot is on the clock");
  }
  return makePick(active, playerId, players, "user");
}

export function undoLastPick(state: SimDraftState): SimDraftState {
  if (state.picks.length === 0) {
    return { ...state, status: "pre_draft", events: [] };
  }
  const picks = state.picks.slice(0, -1);
  const events = state.events.slice(0, -1);
  return {
    ...state,
    status: picks.length === 0 ? "pre_draft" : "drafting",
    picks,
    events,
  };
}

export function getSimDraftSnapshot(
  state: SimDraftState,
  players: readonly SimDraftPlayer[]
): SimDraftSnapshot {
  const currentPickNo = getCurrentPickNo(state);
  const roundInfo =
    currentPickNo == null
      ? null
      : getRoundPick(currentPickNo, state.config.teams);
  const onClockSlot =
    currentPickNo == null
      ? null
      : getDraftSlotForPick(
          currentPickNo,
          state.config.teams,
          state.config.draftType
        );

  return {
    ...state,
    currentPickNo,
    currentRound: roundInfo?.round ?? null,
    currentPickInRound: roundInfo?.pickInRound ?? null,
    onClockSlot,
    isUserTurn: onClockSlot === state.config.userSlot,
    availablePlayerIds: getAvailablePlayers(state, players).map(
      (player) => player.player_id
    ),
    rostersBySlot: buildRostersBySlot(state, players),
  };
}

export function toSleeperDraftDetails(state: SimDraftState): DraftDetails {
  const draftOrder = Object.fromEntries(
    Array.from({ length: state.config.teams }, (_, index) => {
      const slot = index + 1;
      const userId =
        slot === state.config.userSlot
          ? state.config.userId
          : `sim-bot-${String(slot).padStart(2, "0")}`;
      return [userId, slot];
    })
  );

  return DraftDetailsSchema.parse({
    draft_id: state.config.draftId,
    type: state.config.draftType,
    season: state.config.season,
    start_time: null,
    status: state.status,
    metadata: {
      name: state.config.leagueName,
      scoring_type: state.config.scoring,
    },
    settings: {
      teams: state.config.teams,
      rounds: state.config.rounds,
      slots_qb: state.config.rosterSlots.QB,
      slots_rb: state.config.rosterSlots.RB,
      slots_wr: state.config.rosterSlots.WR,
      slots_te: state.config.rosterSlots.TE,
      slots_k: state.config.rosterSlots.K,
      slots_def: state.config.rosterSlots.DEF,
      slots_flex: state.config.rosterSlots.FLEX,
    },
    slot_to_roster_id: Object.fromEntries(
      Array.from({ length: state.config.teams }, (_, index) => {
        const slot = index + 1;
        return [String(slot), slot];
      })
    ),
    draft_order: draftOrder,
  });
}

export function toSleeperDraftPicks(state: SimDraftState): DraftPick[] {
  return DraftPicksSchema.parse(state.picks.map((pick) => ({ ...pick })));
}

export function playersMapFromSimPlayers(
  players: readonly SimDraftPlayer[]
): Record<string, DraftedPlayer> {
  return Object.fromEntries(
    players.map((player) => [
      player.player_id,
      {
        ...player,
        player_id: player.player_id,
        name: player.name,
        position: player.position,
        team: player.team,
        bye_week: player.bye_week,
        rank: player.rank,
        tier: player.tier,
      },
    ])
  );
}

export function bundleToSimPlayers(
  bundle: AggregatesBundleResponseT
): SimDraftPlayer[] {
  const baseLimit = Math.max(220, bundle.teams * 30);
  const playersById = new Map<string, SimDraftPlayer>();
  const addPlayers = (rows: readonly AggregatesBundlePlayerT[]) => {
    for (const player of rows) {
      const simPlayer = bundlePlayerToSimPlayer(player);
      if (simPlayer && !playersById.has(simPlayer.player_id)) {
        playersById.set(simPlayer.player_id, simPlayer);
      }
    }
  };

  addPlayers(
    [...bundle.shards.ALL]
      .sort((a, b) => botSortValueFromBundle(a) - botSortValueFromBundle(b))
      .slice(0, baseLimit)
  );
  addPlayers(bundle.shards.K.slice(0, 40));
  addPlayers(bundle.shards.DEF.slice(0, 40));

  return Array.from(playersById.values()).sort(
    (a, b) => botSortValue(a) - botSortValue(b)
  );
}

export function bundlePlayerToSimPlayer(
  player: AggregatesBundlePlayerT
): SimDraftPlayer | null {
  const position = PositionEnum.safeParse(player.position);
  if (!position.success) return null;
  const rank = draftRankForBundlePlayer(player);
  if (rank == null) return null;
  const tier = Math.ceil(rank / 12);
  const sleeperAdp = validSleeperAdp(player.sleeper.adp);
  return {
    player_id: player.player_id,
    name: player.name,
    position: position.data,
    team: player.team,
    bye_week: player.bye_week == null ? null : String(player.bye_week),
    rank,
    tier,
    sleeperAdp,
    sleeperRank: sleeperAdp ?? rank,
    sleeper_adp: sleeperAdp,
    fp_rank_ave: player.fantasypros.ecr_average,
    fp_rank_pos: parsePositionRank(player.fantasypros.pos_rank),
    position_tier_level: player.fantasypros.tier,
    fbg_rank: player.footballguys?.rank ?? null,
    fbg_rank_pos: player.footballguys?.pos_rank ?? null,
    fbg_tier: player.footballguys?.tier ?? null,
  };
}

function parsePositionRank(value: string | null) {
  if (value == null) return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const rank = Number(match[0]);
  return Number.isFinite(rank) ? rank : null;
}

export function getDraftSlotForPick(
  pickNo: number,
  teams: number,
  draftType: SimDraftType
) {
  const { round, pickInRound } = getRoundPick(pickNo, teams);
  if (draftType === "linear") return pickInRound;
  return round % 2 === 1 ? pickInRound : teams - pickInRound + 1;
}

export function getRoundPick(pickNo: number, teams: number) {
  return {
    round: Math.ceil(pickNo / teams),
    pickInRound: ((pickNo - 1) % teams) + 1,
  };
}

export function getCurrentPickNo(state: SimDraftState) {
  const totalPicks = state.config.teams * state.config.rounds;
  const current = state.picks.length + 1;
  return current > totalPicks ? null : current;
}

function makePick(
  state: SimDraftState,
  playerId: string,
  players: readonly SimDraftPlayer[],
  actor: "user" | "bot"
): SimDraftState {
  const currentPickNo = getCurrentPickNo(state);
  if (currentPickNo == null) return { ...state, status: "complete" };

  const pickedIds = new Set(state.picks.map((pick) => pick.player_id));
  if (pickedIds.has(playerId)) {
    throw new Error(`Player ${playerId} has already been drafted`);
  }

  const player = players.find((candidate) => candidate.player_id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);

  const { round } = getRoundPick(currentPickNo, state.config.teams);
  const draftSlot = getDraftSlotForPick(
    currentPickNo,
    state.config.teams,
    state.config.draftType
  );
  const pick = DraftPickSchema.parse({
    draft_slot: draftSlot,
    round,
    pick_no: currentPickNo,
    player_id: playerId,
  });
  const picks = [...state.picks, pick];
  const status =
    picks.length >= state.config.teams * state.config.rounds
      ? "complete"
      : "drafting";

  return {
    ...state,
    status,
    picks,
    events: [
      ...state.events,
      {
        pickNo: currentPickNo,
        draftSlot,
        playerId,
        playerName: player.name,
        position: player.position,
        actor,
        note:
          actor === "user"
            ? `You selected ${player.name}`
            : buildBotPickNote(state, draftSlot, player),
      },
    ],
  };
}

function chooseBotPlayer(
  state: SimDraftState,
  players: readonly SimDraftPlayer[],
  draftSlot: number
) {
  const available = getAvailablePlayers(state, players);
  if (available.length === 0) {
    throw new Error("No players are available for the simulated pick");
  }

  const currentPickNo = getCurrentPickNo(state);
  if (currentPickNo == null) return available[0]!.player_id;
  const strategyId =
    state.config.botStrategiesBySlot[String(draftSlot)] ??
    state.config.botStrategy;
  return getSimBotStrategy(strategyId).choosePlayer(
    getBotStrategyContext(state, players, draftSlot)
  ).player_id;
}

export function getBotStrategyContext(
  state: SimDraftState,
  players: readonly SimDraftPlayer[],
  draftSlot: number
): BotStrategyContext {
  const currentPickNo = getCurrentPickNo(state);
  if (currentPickNo == null) {
    throw new Error("Cannot build bot strategy context after the draft is complete");
  }
  return {
    available: getAvailablePlayers(state, players),
    needs: getRosterNeedsForSlot(state, players, draftSlot),
    roster: buildRostersBySlot(state, players)[draftSlot] ?? [],
    round: getRoundPick(currentPickNo, state.config.teams).round,
    rounds: state.config.rounds,
    random: seededRandom(`${state.config.seed}:${currentPickNo}`),
  };
}

function botSortValue(player: SimDraftPlayer) {
  return player.sleeper_adp ?? player.sleeperRank ?? player.rank ?? 99999;
}

function botSortValueFromBundle(player: AggregatesBundlePlayerT) {
  return draftRankForBundlePlayer(player) ?? 99999;
}

function validSleeperAdp(adp: number | null) {
  return adp == null || adp >= 900 ? null : adp;
}

function draftRankForBundlePlayer(player: AggregatesBundlePlayerT) {
  const adp = validSleeperAdp(player.sleeper.adp);
  if (adp != null) return adp;
  if (player.position === "K" || player.position === "DEF") {
    return player.tiers.rank;
  }
  return null;
}

function getAvailablePlayers(
  state: SimDraftState,
  players: readonly SimDraftPlayer[]
) {
  const pickedIds = new Set(state.picks.map((pick) => pick.player_id));
  return players.filter((player) => !pickedIds.has(player.player_id));
}

function buildRostersBySlot(
  state: SimDraftState,
  players: readonly SimDraftPlayer[]
) {
  const playersById = new Map(
    players.map((player) => [player.player_id, player])
  );
  const rosters = Object.fromEntries(
    Array.from({ length: state.config.teams }, (_, index) => [index + 1, []])
  ) as Record<number, SimDraftPlayer[]>;

  for (const pick of state.picks) {
    const player = playersById.get(pick.player_id);
    if (player) rosters[pick.draft_slot]?.push(player);
  }
  return rosters;
}

function getRosterNeedsForSlot(
  state: SimDraftState,
  players: readonly SimDraftPlayer[],
  draftSlot: number
) {
  const roster = buildRostersBySlot(state, players)[draftSlot] ?? [];
  const requirements = buildRosterRequirementsFromDraftSettings(
    toSleeperDraftDetails(state).settings
  );
  return calculateTeamNeedsAndCountsForSingleTeam(roster, requirements)
    .positionNeeds;
}

function buildBotPickNote(
  state: SimDraftState,
  draftSlot: number,
  player: SimDraftPlayer
) {
  const label =
    draftSlot === state.config.userSlot ? "Your slot" : `Team ${draftSlot}`;
  return `${label} took ${player.position} value by ADP/need`;
}

function seededRandom(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function assertValidConfig(config: SimDraftConfig) {
  if (config.teams < 2) throw new Error("Sim draft requires at least 2 teams");
  if (config.rounds < 1) throw new Error("Sim draft requires at least 1 round");
  if (config.userSlot < 1 || config.userSlot > config.teams) {
    throw new Error("User slot must be within the configured team count");
  }
}

function assertPlayerCapacity(
  config: SimDraftConfig,
  players: readonly SimDraftPlayer[]
) {
  const required = config.teams * config.rounds;
  const available = new Set(players.map((player) => player.player_id)).size;
  if (available < required) {
    throw new Error(
      `Mock draft requires ${required} ranked players for ${config.teams} teams and ${config.rounds} rounds; only ${available} are available.`
    );
  }
}
