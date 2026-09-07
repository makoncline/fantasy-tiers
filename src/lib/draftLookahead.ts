import { buildDraftValueBoard, type DraftTeamRosterState, type DraftValueBoard, type DraftValueBoardInput } from "./draftValue";
import { calculateTeamNeedsAndCountsForSingleTeam } from "./draftHelpers";
import { buildDraftChoices, type DraftChoiceSnapshot } from "./draftChoices";
import type { DraftCandidate } from "./draftCandidate";
import type { Position, RosterSlot } from "./schemas";
import {
  buildMarketOrderScenario, getChoicePickWindow, LOOKAHEAD_POSITIONS, opponentWindowSlots,
  type ScenarioSelection,
} from "./draftLookaheadCore";

type ScenarioPlayer = DraftCandidate & {
  drafted?: boolean | null;
  draftedByMe?: boolean | null;
  picked?: boolean | { overall?: number | null } | null;
};

function completeRequirements(input: Partial<Record<RosterSlot, number>>): Record<RosterSlot, number> {
  return { QB: input.QB ?? 0, RB: input.RB ?? 0, WR: input.WR ?? 0,
    TE: input.TE ?? 0, K: input.K ?? 0, DEF: input.DEF ?? 0,
    FLEX: input.FLEX ?? 0, BN: input.BN ?? 0 };
}

function rosterFromCounts(counts: Partial<Record<Position, number>>, requirements: Record<RosterSlot, number>) {
  const players = LOOKAHEAD_POSITIONS.flatMap((position) =>
    Array.from({ length: Math.max(0, Math.floor(counts[position] ?? 0)) }, () => ({ position })));
  return calculateTeamNeedsAndCountsForSingleTeam(players, requirements);
}

function addSelectionsToTeam(state: DraftTeamRosterState, picks: readonly ScenarioSelection[], requirements: Record<RosterSlot, number>) {
  const counts = { ...state.positionCounts };
  for (const pick of picks) if (pick.slot === state.draftSlot) counts[pick.position] = (counts[pick.position] ?? 0) + 1;
  const roster = rosterFromCounts(counts, requirements);
  return { ...state, positionCounts: roster.positionCounts,
    starterNeeds: roster.positionNeeds, benchSlotsRemaining: roster.positionNeeds.BN };
}

/** Uses the EXISTING recommender on a copied hypothetical state; no active writes. */
function buildDraftLookaheadChecked(snapshot: DraftChoiceSnapshot, selectedNowId: string, currentBoard?: DraftValueBoard<DraftCandidate>) {
  const input = snapshot.boardInput;
  const configuredPositions = LOOKAHEAD_POSITIONS.filter((position) =>
    (input.rosterRequirements[position] ?? 0) > 0 ||
    (["RB", "WR", "TE"].includes(position) && (input.rosterRequirements.FLEX ?? 0) > 0));
  const scenario = buildMarketOrderScenario({ turn: input, players: input.players,
    selectedNowId, configuredPositions });
  const base = { scenario, board: null, snapshot: null, choices: [], positionLead: null };
  if (scenario.status !== "ready" || scenario.window.nextOwnPick == null) return base;
  const eligibilityBoard = currentBoard ?? buildDraftValueBoard(input);
  if (!eligibilityBoard.recommendations.some((player) => player.player_id === selectedNowId)) {
    return { ...base, scenario: { ...scenario, status: "blocked" as const,
      message: "This first pick is not eligible under the current owner policy." } };
  }
  const own = input.players.find((p) => p.player_id === selectedNowId);
  if (!own) return base;
  const teams = input.teamRosterStates;
  if (teams && (new Set(teams.map((team) => team.draftSlot)).size !== teams.length ||
      teams.some((team) => !Number.isInteger(team.draftSlot) || team.draftSlot < 1 || team.draftSlot > input.teams))) {
    return { ...base, scenario: { ...scenario, status: "blocked" as const,
      message: "Opponent roster identities are inconsistent. Use the current recommendation." } };
  }
  const requirements = completeRequirements(input.rosterRequirements);
  const selectedById = new Map(scenario.selections.map((pick) => [pick.playerId, pick]));
  const players: ScenarioPlayer[] = input.players.map((player) => {
    const pick = selectedById.get(player.player_id);
    return pick ? { ...player, drafted: true, picked: { overall: pick.pick },
      draftedByMe: pick.kind === "owner" } : { ...player };
  });
  const counts = { ...input.userPositionCounts,
    [own.position]: (input.userPositionCounts[own.position] ?? 0) + 1 };
  const ownRoster = rosterFromCounts(counts, requirements);
  const teamRosterStates = input.teamRosterStates?.map((state) =>
    addSelectionsToTeam(state, scenario.selections, requirements));
  // Only recompute full-room demand when every team is represented. Do not
  // pretend a partial roster feed describes the whole room.
  const draftWideNeeds = teamRosterStates?.length === input.teams
    ? Object.fromEntries([...LOOKAHEAD_POSITIONS, "FLEX" as const].map((position) => [position,
      teamRosterStates.reduce((sum, state) => sum + (state.starterNeeds[position] ?? 0), 0)]))
    : input.draftWideNeeds;
  const boardInput: DraftValueBoardInput<ScenarioPlayer> = {
    ...input, players, currentPick: scenario.window.nextOwnPick,
    userPositionCounts: ownRoster.positionCounts,
    userPositionNeeds: ownRoster.positionNeeds,
    userRosterPlayers: [...(input.userRosterPlayers ?? []), own],
    teamRosterStates, draftWideNeeds,
  };
  // Do not make a first pick legal by checking it only in the earlier room
  // state. Pending opponent removals and the round boundary can change policy.
  if (scenario.window.beforeOwn && scenario.window.ownPick != null) {
    const ownPick = scenario.window.ownPick;
    const before = new Map(scenario.selections.filter((pick) => pick.pick < ownPick)
      .map((pick) => [pick.playerId, pick]));
    const atOwnTeams = input.teamRosterStates?.map((state) => addSelectionsToTeam(state, [...before.values()], requirements));
    const atOwnDemand = atOwnTeams?.length === input.teams
      ? Object.fromEntries([...LOOKAHEAD_POSITIONS, "FLEX" as const].map((position) => [position,
        atOwnTeams.reduce((sum, state) => sum + (state.starterNeeds[position] ?? 0), 0)])) : input.draftWideNeeds;
    const atOwnTurn = buildDraftValueBoard({
      ...input, currentPick: ownPick,
      players: input.players.map((player) => {
        const pick = before.get(player.player_id);
        return pick ? { ...player, drafted: true, picked: { overall: pick.pick }, draftedByMe: false } : { ...player };
      }),
      teamRosterStates: atOwnTeams, draftWideNeeds: atOwnDemand,
    });
    if (!atOwnTurn.recommendations.some((player) => player.player_id === selectedNowId)) {
      return { ...base, scenario: { ...scenario, status: "blocked" as const,
        message: "This first pick is not eligible at your upcoming turn in this scenario." } };
    }
  }
  const board = buildDraftValueBoard(boardInput);
  const projectedSnapshot: DraftChoiceSnapshot = { ...snapshot, boardInput };
  return { scenario, board, snapshot: projectedSnapshot, choices: buildDraftChoices(board),
    positionLead: board.topRecommendation?.player.position ?? null };
}

/** A failed optional scenario must not remove the real recommendation row. */
export function buildDraftLookahead(snapshot: DraftChoiceSnapshot, selectedNowId: string, currentBoard?: DraftValueBoard<DraftCandidate>) {
  try {
    return buildDraftLookaheadChecked(snapshot, selectedNowId, currentBoard);
  } catch {
    return {
      scenario: {
        status: "blocked" as const,
        message: "Scenario calculation is unavailable. Use the unchanged current recommendation row.",
        window: getChoicePickWindow(snapshot.boardInput), selectedNowId,
        selections: [], remainingIds: [], unpricedCount: 0,
      },
      board: null, snapshot: null, choices: [], positionLead: null,
    };
  }
}

/** Current roster FACTS in the window; not a new opponent selection modifier. */
export function getLookaheadRoomFacts(snapshot: DraftChoiceSnapshot) {
  const { boardInput: input } = snapshot;
  const window = getChoicePickWindow(input);
  const visits = opponentWindowSlots(input, window);
  const states = new Map(input.teamRosterStates?.map((state) => [state.draftSlot, state]));
  return [...visits].map(([slot, picks]) => {
    const state = states.get(slot);
    return { slot, picks, known: state != null,
      qbCount: state?.positionCounts.QB ?? null,
      teCount: state?.positionCounts.TE ?? null,
      openSlots: state ? Object.entries(state.starterNeeds)
        .filter(([position, count]) => position !== "BN" && count > 0)
        .map(([position, count]) => `${count} ${position}`).join(", ") || "No open starter slots" : "Roster unavailable" };
  });
}
