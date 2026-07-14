import type { DraftDetails } from "./draftDetails";
import type { DraftPick } from "./schemas";
import type {
  DraftedPlayer,
  RosterSlot,
  Position,
} from "./schemas";
import type { DraftCandidate } from "./draftCandidate";
import {
  buildRosterRequirementsFromDraftSettings,
  calculateTeamNeedsAndCountsForSingleTeam,
  calculateTotalRemainingNeeds,
} from "./draftHelpers";
import {
  buildDraftValueBoard,
  type DraftTeamRosterState,
  type DraftValueBoard,
} from "./draftValue";

export type PlayerWithDraftMeta = DraftCandidate & {
  drafted: boolean;
  picked?: { overall: number };
  pick_no?: number;
  round?: number;
  pick_in_round?: number;
  draft_slot?: number;
};

type RankedDraftCandidate = PlayerWithDraftMeta & {
  rank: number;
  tier: number;
};

type RecommendationDraftCandidate = PlayerWithDraftMeta & {
  draftedByMe: boolean;
};

export function computeRoundPick(pickNo: number, teams: number) {
  if (!teams || teams <= 0) return { round: 0, pick_in_round: 0 };
  const round = Math.ceil(pickNo / teams);
  const pick_in_round = ((pickNo - 1) % teams) + 1;
  return { round, pick_in_round };
}

export function buildDraftState(args: {
  playersMap: Record<string, DraftCandidate>;
  draft: DraftDetails;
  picks: DraftPick[];
}) {
  const { playersMap, draft, picks } = args;
  const teams = draft?.settings?.teams ?? 0;

  // Index picks by player_id for quick lookup
  const pickByPlayerId = new Map<string, DraftPick>();
  for (const p of picks) {
    if (p && p.player_id) pickByPlayerId.set(String(p.player_id), p);
  }

  const playersWithDraft: Record<string, PlayerWithDraftMeta> = {};
  const drafted: PlayerWithDraftMeta[] = [];
  const available: RankedDraftCandidate[] = [];

  for (const [id, player] of Object.entries(playersMap)) {
    const pick = pickByPlayerId.get(id);
    if (pick) {
      const { round, pick_in_round } = computeRoundPick(pick.pick_no, teams);
      const merged: PlayerWithDraftMeta = {
        ...player,
        drafted: true,
        picked: { overall: pick.pick_no },
        pick_no: pick.pick_no,
        round,
        pick_in_round,
        draft_slot: pick.draft_slot,
      };
      playersWithDraft[id] = merged;
      drafted.push(merged);
    } else {
      const merged: PlayerWithDraftMeta = {
        ...player,
        drafted: false,
      };
      playersWithDraft[id] = merged;
      if (merged.rank != null && merged.tier != null) {
        available.push({ ...merged, rank: merged.rank, tier: merged.tier });
      }
    }
  }

  drafted.sort((a, b) => (a.pick_no ?? 0) - (b.pick_no ?? 0));
  available.sort((a, b) => a.rank - b.rank);

  const draftedIds = new Set(drafted.map((p) => p.player_id));

  return {
    players: playersWithDraft,
    drafted,
    available,
    draftedIds,
    teams,
  };
}

export function groupAvailableByPosition(available: RankedDraftCandidate[]) {
  const out: Record<string, RankedDraftCandidate[]> = {};
  for (const p of available) {
    if (!out[p.position]) out[p.position] = [];
    out[p.position]!.push(p);
  }
  for (const k of Object.keys(out)) {
    if (out[k]) {
      out[k].sort((a, b) => a.rank - b.rank);
    }
  }
  return out;
}

export function topAvailableByPosition(
  availableByPosition: Record<string, RankedDraftCandidate[]>,
  limit: number
) {
  const out: Record<string, RankedDraftCandidate[]> = {};
  for (const [pos, arr] of Object.entries(availableByPosition)) {
    out[pos] = arr.slice(0, Math.max(0, limit));
  }
  return out;
}

const CONTEXT_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const FLEX_CONTEXT_POSITIONS = ["RB", "WR", "TE"] as const;

type DraftRosterView = {
  players: (PlayerWithDraftMeta | DraftedPlayer)[];
  remainingPositionRequirements: Partial<Record<RosterSlot | "BN", number>>;
  rosterPositionCounts: Partial<Record<RosterSlot | "BN", number>>;
};

export type DraftContextPlayer = {
  playerId: string;
  name: string;
  position: Position;
  team: string | null;
  byeWeek: string | null;
  rank: number | null;
  tier: number | null;
  valueScore: number | null;
  comebackLabel: string | null;
  actionLabel: string | null;
};

export type DraftContextPositionOutlook = {
  position: Position;
  label:
    | "starter hole"
    | "flex target"
    | "room run"
    | "tier cliff"
    | "bench option"
    | "wait";
  pressure: "hot" | "scarce" | "deep" | "cool";
  availableCount: number;
  bestTier: number | null;
  sameTierAvailable: number;
  leagueStarterSlotsRemaining: number;
  userStarterSlotsRemaining: number;
  topPlayers: DraftContextPlayer[];
};

export type DraftContext = {
  room: {
    teams: number;
    rounds: number;
    currentPick: number | null;
    completedPicks: number;
    totalPicks: number;
    totalPicksRemaining: number;
    totalRosterSlotsRemaining: number;
    nextUserPick: number | null;
    picksUntilNextTurn: number | null;
    leagueStarterSlotsInitial: Record<Position | "FLEX", number>;
    leagueStarterSlotsRemaining: Record<Position | "FLEX", number>;
    leagueBenchSlotsRemaining: number;
    leagueBenchDemandInitialByPosition: Record<Position, number>;
    leagueBenchDemandByPosition: Record<Position, number>;
    draftedPositionCounts: Record<Position, number>;
    recentRun: {
      window: number;
      sequence: { pickNo: number; position: Position | null; playerName: string | null }[];
      counts: Record<Position, number>;
    };
  };
  user: {
    draftSlot: number | null;
    totalSlotsRemaining: number;
    starterSlotsRemaining: Record<Position | "FLEX", number>;
    benchSlotsRemaining: number;
    benchDemandByPosition: Record<Position, number>;
    draftedPositionCounts: Record<Position, number>;
    byeWeeksByPosition: Partial<Record<Position, string[]>>;
  };
  positionOutlook: DraftContextPositionOutlook[];
  draftQuestions: string[];
};

function zeroPositionCounts(): Record<Position, number> {
  return {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };
}

function zeroStarterSlots(): Record<Position | "FLEX", number> {
  return {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
    FLEX: 0,
  };
}

function isContextPosition(value: unknown): value is Position {
  return typeof value === "string" && CONTEXT_POSITIONS.includes(value as Position);
}

function isFlexContextPosition(position: Position) {
  return FLEX_CONTEXT_POSITIONS.includes(position as (typeof FLEX_CONTEXT_POSITIONS)[number]);
}

function countRosterSlots(
  roster: DraftRosterView | undefined,
  slot: RosterSlot | "BN"
) {
  return Math.max(0, roster?.remainingPositionRequirements?.[slot] ?? 0);
}

function sumRosterSlots(
  rosters: Record<number, DraftRosterView>,
  slot: RosterSlot | "BN"
) {
  return Object.values(rosters).reduce(
    (total, roster) => total + countRosterSlots(roster, slot),
    0
  );
}

function countDraftedPositions(
  players: readonly (PlayerWithDraftMeta | DraftedPlayer)[]
) {
  const counts = zeroPositionCounts();
  for (const player of players) {
    if (isContextPosition(player.position)) {
      counts[player.position] += 1;
    }
  }
  return counts;
}

function addPositionDemand(
  target: Record<Position, number>,
  source: Record<Position, number>
) {
  for (const position of CONTEXT_POSITIONS) {
    target[position] += source[position];
  }
}

function estimateBenchDemandForRoster(
  roster: DraftRosterView | undefined,
  rosterRequirements?: Record<RosterSlot, number>
): Record<Position, number> {
  const demand = zeroPositionCounts();
  const benchSlots = countRosterSlots(roster, "BN");
  if (!roster || benchSlots <= 0) return demand;

  const counts = countDraftedPositions(roster.players);
  const allowsQb = (rosterRequirements?.QB ?? 1) > 0;
  const allowsTe =
    (rosterRequirements?.TE ?? 1) > 0 || (rosterRequirements?.FLEX ?? 1) > 0;
  const qbDemand = allowsQb
    ? Math.min(0.35, Math.max(0, 2 - counts.QB) * 0.12)
    : 0;
  const teDemand = allowsTe
    ? Math.min(0.45, Math.max(0, 2 - counts.TE) * 0.16)
    : 0;
  demand.QB = Math.min(benchSlots, qbDemand);
  demand.TE = Math.min(benchSlots, teDemand);

  const rbWrSlots = Math.max(0, benchSlots - demand.QB - demand.TE);
  const rbShare = counts.RB <= counts.WR ? 0.55 : 0.45;
  demand.RB = rbWrSlots * rbShare;
  demand.WR = rbWrSlots - demand.RB;

  return demand;
}

function estimateLeagueBenchDemandByPosition(
  rosters: Record<number, DraftRosterView>,
  rosterRequirements: Record<RosterSlot, number>
) {
  const demand = zeroPositionCounts();
  for (const roster of Object.values(rosters)) {
    addPositionDemand(
      demand,
      estimateBenchDemandForRoster(roster, rosterRequirements)
    );
  }
  return demand;
}

function buildInitialStarterSlots(
  teams: number,
  rosterRequirements: Record<RosterSlot, number>
) {
  const slots = zeroStarterSlots();
  for (const position of CONTEXT_POSITIONS) {
    slots[position] = teams * (rosterRequirements[position] ?? 0);
  }
  slots.FLEX = teams * (rosterRequirements.FLEX ?? 0);
  return slots;
}

function estimateInitialBenchDemandByPosition(
  teams: number,
  rosterRequirements: Record<RosterSlot, number>
) {
  const perTeamRoster: DraftRosterView = {
    players: [],
    remainingPositionRequirements: { BN: rosterRequirements.BN },
    rosterPositionCounts: {},
  };
  const perTeamDemand = estimateBenchDemandForRoster(
    perTeamRoster,
    rosterRequirements
  );
  const demand = zeroPositionCounts();
  for (const position of CONTEXT_POSITIONS) {
    demand[position] = perTeamDemand[position] * teams;
  }
  return demand;
}

function collectByeWeeksByPosition(
  players: readonly (PlayerWithDraftMeta | DraftedPlayer)[]
) {
  const out: Partial<Record<Position, string[]>> = {};
  for (const player of players) {
    if (!isContextPosition(player.position) || player.bye_week == null) {
      continue;
    }
    const bye = String(player.bye_week);
    const byes = out[player.position] ?? [];
    if (!byes.includes(bye)) byes.push(bye);
    out[player.position] = byes;
  }
  for (const byes of Object.values(out)) {
    byes.sort((a, b) => Number(a) - Number(b));
  }
  return out;
}

function buildTeamRosterStates(
  rosters: Record<number, DraftRosterView>
): DraftTeamRosterState[] {
  return Object.entries(rosters).map(([draftSlot, roster]) => {
    const positionCounts: Partial<Record<Position, number>> = {};
    for (const position of CONTEXT_POSITIONS) {
      positionCounts[position] = roster.rosterPositionCounts[position] ?? 0;
    }

    const starterNeeds: Partial<Record<RosterSlot, number>> = {};
    for (const slot of [...CONTEXT_POSITIONS, "FLEX"] as const) {
      starterNeeds[slot] = roster.remainingPositionRequirements[slot] ?? 0;
    }

    return {
      draftSlot: Number(draftSlot),
      positionCounts,
      starterNeeds,
      benchSlotsRemaining: roster.remainingPositionRequirements.BN ?? 0,
    };
  });
}

function summarizePlayerForContext(
  player: RankedDraftCandidate,
  draftValueBoard: DraftValueBoard<RecommendationDraftCandidate> | null
): DraftContextPlayer {
  const metrics = draftValueBoard?.metricsByPlayerId[player.player_id];
  return {
    playerId: player.player_id,
    name: player.name,
    position: player.position,
    team: player.team,
    byeWeek: player.bye_week,
    rank: player.rank ?? null,
    tier: player.tier ?? null,
    valueScore: metrics?.recommendationScore ?? null,
    comebackLabel: metrics?.comebackLabel ?? null,
    actionLabel: metrics?.actionLabel ?? null,
  };
}

function pressureForPosition(args: {
  recentCount: number;
  leagueStarterSlotsRemaining: number;
  availableCount: number;
  sameTierAvailable: number;
}): DraftContextPositionOutlook["pressure"] {
  if (args.recentCount >= 3) return "hot";
  if (
    args.leagueStarterSlotsRemaining > 0 &&
    args.availableCount <= Math.max(2, args.leagueStarterSlotsRemaining)
  ) {
    return "scarce";
  }
  if (args.sameTierAvailable >= 3 || args.availableCount >= args.leagueStarterSlotsRemaining + 8) {
    return "deep";
  }
  return "cool";
}

function labelForPosition(args: {
  position: Position;
  userDirectNeed: number;
  userFlexNeed: number;
  userBenchNeed: number;
  recentCount: number;
  sameTierAvailable: number;
  hasAvailablePlayers: boolean;
}): DraftContextPositionOutlook["label"] {
  if (args.userDirectNeed > 0) return "starter hole";
  if (isFlexContextPosition(args.position) && args.userFlexNeed > 0) {
    return "flex target";
  }
  if (args.recentCount >= 3) return "room run";
  if (args.hasAvailablePlayers && args.sameTierAvailable <= 1) {
    return "tier cliff";
  }
  if (
    args.userBenchNeed > 0 &&
    (args.position === "RB" || args.position === "WR")
  ) {
    return "bench option";
  }
  return "wait";
}

function buildDraftQuestions() {
  return [
    "Which position loses the most value before our next pick?",
    "Which starter or FLEX slots are still open?",
    "Is the current player before a tier cliff, or are same-tier options left?",
    "Can a similar player come back at our next pick?",
    "Are we drafting a backup QB, TE, K, or DEF before higher-upside RB/WR depth?",
    "Is any source stale, thin, or contradicted by news or market movement?",
    "Does this pick create bye-week or roster-construction fragility?",
  ];
}

function buildDraftContext(args: {
  base: ReturnType<typeof buildDraftState>;
  draft: DraftDetails;
  picks: DraftPick[];
  rosters: Record<number, DraftRosterView>;
  rosterRequirements: Record<RosterSlot, number>;
  availableByPosition: Record<string, RankedDraftCandidate[]>;
  userSlot: number | undefined;
  userRoster: DraftRosterView | undefined;
  draftValueBoard: DraftValueBoard<RecommendationDraftCandidate> | null;
}): DraftContext {
  const { base, draft, picks, rosters, availableByPosition, userSlot, userRoster } =
    args;
  const teams = draft.settings?.teams ?? base.teams;
  const rounds = draft.settings?.rounds ?? 0;
  const completedPicks = picks.filter((pick) => pick && pick.player_id).length;
  const totalPicks = teams > 0 && rounds > 0 ? teams * rounds : 0;
  const totalPicksRemaining =
    totalPicks > 0 ? Math.max(0, totalPicks - completedPicks) : 0;

  const leagueStarterSlotsInitial = buildInitialStarterSlots(
    teams,
    args.rosterRequirements
  );
  const leagueStarterSlotsRemaining = zeroStarterSlots();
  for (const position of CONTEXT_POSITIONS) {
    leagueStarterSlotsRemaining[position] = sumRosterSlots(rosters, position);
  }
  leagueStarterSlotsRemaining.FLEX = sumRosterSlots(rosters, "FLEX");

  const starterSlotsRemainingTotal = Object.values(
    leagueStarterSlotsRemaining
  ).reduce((total, value) => total + value, 0);
  const rawLeagueBenchSlotsRemaining = sumRosterSlots(rosters, "BN");
  const leagueBenchSlotsRemaining =
    totalPicks > 0
      ? Math.max(0, totalPicksRemaining - starterSlotsRemainingTotal)
      : rawLeagueBenchSlotsRemaining;
  const leagueBenchDemandInitialByPosition =
    estimateInitialBenchDemandByPosition(teams, args.rosterRequirements);
  const leagueBenchDemandByPosition =
    estimateLeagueBenchDemandByPosition(rosters, args.rosterRequirements);
  const totalRosterSlotsRemaining =
    totalPicks > 0
      ? totalPicksRemaining
      : starterSlotsRemainingTotal + rawLeagueBenchSlotsRemaining;

  const sortedPicks = [...picks]
    .filter((pick) => pick && pick.player_id)
    .sort((a, b) => a.pick_no - b.pick_no);
  const recentPicks = sortedPicks.slice(-12);
  const recentRunCounts = zeroPositionCounts();
  const recentRunSequence = recentPicks.map((pick) => {
    const player = base.players[pick.player_id];
    const position = isContextPosition(player?.position)
      ? player.position
      : null;
    if (position) recentRunCounts[position] += 1;
    return {
      pickNo: pick.pick_no,
      position,
      playerName: player?.name ?? null,
    };
  });

  const userStarterSlotsRemaining = zeroStarterSlots();
  for (const position of CONTEXT_POSITIONS) {
    userStarterSlotsRemaining[position] = countRosterSlots(
      userRoster,
      position
    );
  }
  userStarterSlotsRemaining.FLEX = countRosterSlots(userRoster, "FLEX");
  const userBenchSlotsRemaining = countRosterSlots(userRoster, "BN");
  const userBenchDemandByPosition = estimateBenchDemandForRoster(
    userRoster,
    args.rosterRequirements
  );
  const userDraftedPositionCounts = countDraftedPositions(
    userRoster?.players ?? []
  );

  const positionOutlook = CONTEXT_POSITIONS.map((position) => {
    const available = availableByPosition[position] ?? [];
    const topPlayers = available
      .slice(0, 3)
      .map((player) =>
        summarizePlayerForContext(player, args.draftValueBoard)
      );
    const bestTier = topPlayers[0]?.tier ?? null;
    const sameTierAvailable =
      bestTier == null
        ? 0
        : available.filter((player) => player.tier === bestTier).length;
    const leagueDirectNeed = leagueStarterSlotsRemaining[position] ?? 0;
    const leagueFlexNeed = isFlexContextPosition(position)
      ? leagueStarterSlotsRemaining.FLEX
      : 0;
    const userDirectNeed = userStarterSlotsRemaining[position] ?? 0;
    const userFlexNeed = userStarterSlotsRemaining.FLEX;
    const recentCount = recentRunCounts[position] ?? 0;

    return {
      position,
      label: labelForPosition({
        position,
        userDirectNeed,
        userFlexNeed,
        userBenchNeed: userBenchSlotsRemaining,
        recentCount,
        sameTierAvailable,
        hasAvailablePlayers: topPlayers.length > 0,
      }),
      pressure: pressureForPosition({
        recentCount,
        leagueStarterSlotsRemaining: leagueDirectNeed + leagueFlexNeed,
        availableCount: available.length,
        sameTierAvailable,
      }),
      availableCount: available.length,
      bestTier,
      sameTierAvailable,
      leagueStarterSlotsRemaining: leagueDirectNeed + leagueFlexNeed,
      userStarterSlotsRemaining:
        userDirectNeed + (isFlexContextPosition(position) ? userFlexNeed : 0),
      topPlayers,
    };
  });

  return {
    room: {
      teams,
      rounds,
      currentPick:
        totalPicks > 0 && completedPicks >= totalPicks
          ? null
          : completedPicks + 1,
      completedPicks,
      totalPicks,
      totalPicksRemaining,
      totalRosterSlotsRemaining,
      nextUserPick: args.draftValueBoard?.nextPick ?? null,
      picksUntilNextTurn: args.draftValueBoard?.picksUntilNextTurn ?? null,
      leagueStarterSlotsInitial,
      leagueStarterSlotsRemaining,
      leagueBenchSlotsRemaining,
      leagueBenchDemandInitialByPosition,
      leagueBenchDemandByPosition,
      draftedPositionCounts: countDraftedPositions(base.drafted),
      recentRun: {
        window: recentPicks.length,
        sequence: recentRunSequence,
        counts: recentRunCounts,
      },
    },
    user: {
      draftSlot: userSlot ?? null,
      totalSlotsRemaining:
        Object.values(userStarterSlotsRemaining).reduce(
          (total, value) => total + value,
          0
        ) + userBenchSlotsRemaining,
      starterSlotsRemaining: userStarterSlotsRemaining,
      benchSlotsRemaining: userBenchSlotsRemaining,
      benchDemandByPosition: userBenchDemandByPosition,
      draftedPositionCounts: userDraftedPositionCounts,
      byeWeeksByPosition: collectByeWeeksByPosition(userRoster?.players ?? []),
    },
    positionOutlook,
    draftQuestions: buildDraftQuestions(),
  };
}

export function buildDraftViewModel(args: {
  playersMap: Record<string, DraftCandidate>;
  draft: DraftDetails;
  picks: DraftPick[];
  userId?: string;
  topLimit?: number;
}) {
  const {
    playersMap,
    draft,
    picks,
    userId,
    topLimit = 3,
  } = args;
  const base = buildDraftState({ playersMap, draft, picks });

  // Roster requirements from draft settings
  const rosterRequirements = buildRosterRequirementsFromDraftSettings(
    draft.settings
  );

  // Build rosters for each draft slot
  const teams = draft.settings?.teams ?? 0;
  const draftSlots = Array.from({ length: teams }, (_, i) => i + 1);
  const rosters: Record<number, DraftRosterView> = {};

  for (const slot of draftSlots) {
    const rosteredPlayers = base.drafted.filter((p) => p.draft_slot === slot);
    const rosterReqsWithoutBN: Record<RosterSlot, number> = {
      QB: rosterRequirements.QB,
      RB: rosterRequirements.RB,
      WR: rosterRequirements.WR,
      TE: rosterRequirements.TE,
      K: rosterRequirements.K,
      DEF: rosterRequirements.DEF,
      FLEX: rosterRequirements.FLEX,
      BN: rosterRequirements.BN,
    };
    const { positionNeeds, positionCounts } =
      calculateTeamNeedsAndCountsForSingleTeam(
        rosteredPlayers,
        rosterReqsWithoutBN
      );
    rosters[slot] = {
      players: rosteredPlayers,
      remainingPositionRequirements: positionNeeds,
      rosterPositionCounts: positionCounts,
    };
  }

  const userSlot = userId
    ? (draft.draft_order?.[userId] as number | undefined)
    : undefined;
  const userRoster = userSlot ? rosters[userSlot] : undefined;
  const recommendationPlayers = Object.values(base.players).map((player) => ({
    ...player,
    draftedByMe:
      player.drafted && userSlot != null && player.draft_slot === userSlot,
  }));
  const teamRosterStates = buildTeamRosterStates(rosters);
  const availableByPosition = groupAvailableByPosition(base.available);
  const topAvailable = topAvailableByPosition(availableByPosition, topLimit);
  const draftWideNeeds = calculateTotalRemainingNeeds(
    Object.fromEntries(
      Object.entries(rosters).map(([k, v]) => {
        // Filter out "BN" and ensure all Position keys are present with defaults
        const {
          BN,
          QB = 0,
          RB = 0,
          WR = 0,
          TE = 0,
          K = 0,
          DEF = 0,
          FLEX = 0,
          ...others
        } = v.remainingPositionRequirements;
        const positionRequirements: Record<Position, number> = {
          QB,
          RB,
          WR,
          TE,
          K,
          DEF,
        };
        return [k, { remainingPositionRequirements: positionRequirements }];
      })
    )
  );
  const draftValueBoard = userRoster
    ? buildDraftValueBoard({
        players: recommendationPlayers,
        teams,
        rounds: draft.settings?.rounds,
        draftType: draft.type,
        currentPick:
          picks.filter((pick) => pick && pick.player_id).length + 1,
        userSlot,
        rosterRequirements,
        userPositionCounts: userRoster.rosterPositionCounts,
        userPositionNeeds: userRoster.remainingPositionRequirements,
        draftWideNeeds,
        teamRosterStates,
        userRosterPlayers: userRoster.players,
      })
    : null;
  const draftContext = buildDraftContext({
    base,
    draft,
    picks,
    rosters,
    rosterRequirements,
    availableByPosition,
    userSlot,
    userRoster,
    draftValueBoard,
  });

  return {
    ...base,
    availableByPosition,
    topAvailablePlayersByPosition: topAvailable,
    userRoster,
    teamRosterStates,
    draftWideNeeds,
    recommendationBoard: draftValueBoard,
    draftContext,
    rosterRequirements,
  };
}
