import { getDraftTurnContext, pickSlot, type DraftTurnInput } from "./draftTurn";

/** Display-only scenarios. There are no player-quality or opponent-need weights. */
export const LOOKAHEAD_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
export type LookaheadPosition = (typeof LOOKAHEAD_POSITIONS)[number];

export type MarketScenarioPlayer = {
  player_id: string;
  name: string;
  position: LookaheadPosition;
  sleeper_board_rank?: number | null;
  sleeper_adp?: number | null;
  drafted?: boolean | null;
  picked?: boolean | { overall?: number | null } | null;
};

export type PickWindow = {
  state: "ready" | "final" | "complete" | "unknown";
  ownPick: number | null;
  nextOwnPick: number | null;
  beforeOwn: number | null;
  betweenOwn: number | null;
  onClock: boolean;
};

/** Before our turn, distinguish the approach to our pick from the wait AFTER it. */
export function getChoicePickWindow(input: DraftTurnInput): PickWindow {
  const turn = getDraftTurnContext(input);
  if (turn.state === "unknown") {
    return { state: "unknown", ownPick: null, nextOwnPick: null,
      beforeOwn: null, betweenOwn: null, onClock: false };
  }
  if (turn.nextPick == null) {
    return { state: "complete", ownPick: null, nextOwnPick: null,
      beforeOwn: null, betweenOwn: null, onClock: false };
  }
  const ownPick = turn.nextPick;
  const afterOwn = getDraftTurnContext({ ...input, currentPick: ownPick });
  const nextOwnPick = afterOwn.comebackTargetPick;
  return {
    state: nextOwnPick == null ? "final" : "ready",
    ownPick,
    nextOwnPick,
    beforeOwn: ownPick - input.currentPick,
    betweenOwn: nextOwnPick == null ? null : nextOwnPick - ownPick - 1,
    onClock: ownPick === input.currentPick,
  };
}

export function formatDraftPick(pick: number | null, teams: number): string {
  if (pick == null || !Number.isSafeInteger(pick) || pick < 1 ||
      !Number.isSafeInteger(teams) || teams < 1) return "—";
  return `${Math.ceil(pick / teams)}.${String((pick - 1) % teams + 1).padStart(2, "0")}`;
}

export function isScenarioAvailable(player: MarketScenarioPlayer): boolean {
  return !player.drafted && !player.picked;
}

export function usableMarketNumber(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 && value < 900 ? value : null;
}

export function scenarioMarketOrder(player: MarketScenarioPlayer) {
  const board = usableMarketNumber(player.sleeper_board_rank);
  if (board != null) return { value: board, source: "board" as const };
  const adp = usableMarketNumber(player.sleeper_adp);
  return adp == null ? null : { value: adp, source: "ADP" as const };
}

export type ScenarioSelection = {
  pick: number;
  slot: number;
  playerId: string;
  name: string;
  position: LookaheadPosition;
  kind: "opponent" | "owner";
};

export type MarketOrderScenario = {
  status: "ready" | "blocked" | "no-next" | "unknown";
  message: string;
  window: PickWindow;
  selectedNowId: string;
  selections: ScenarioSelection[];
  remainingIds: string[];
  unpricedCount: number;
};

/**
 * One explicit what-if: each opponent selects the highest remaining platform
 * market entry. Not the experimental probability model and not a prediction.
 * Never filter opponents by our ECR rule, backup limits, or construction policy.
 */
export function buildMarketOrderScenario<T extends MarketScenarioPlayer>(input: {
  turn: DraftTurnInput;
  players: readonly T[];
  selectedNowId: string;
  configuredPositions: readonly LookaheadPosition[];
}): MarketOrderScenario {
  const window = getChoicePickWindow(input.turn);
  const empty: MarketOrderScenario = {
    status: "unknown", message: "Draft-turn information is incomplete.", window,
    selectedNowId: input.selectedNowId, selections: [], remainingIds: [], unpricedCount: 0,
  };
  if (window.state === "unknown") return empty;
  if (window.state === "complete" || window.state === "final") {
    return { ...empty, status: "no-next", message: "No selection follows your final pick." };
  }
  if (window.ownPick == null || window.nextOwnPick == null) return empty;
  if (new Set(input.players.map((p) => p.player_id)).size !== input.players.length) {
    return { ...empty, status: "blocked", message: "Duplicate player IDs prevent a reliable preview." };
  }
  const available = input.players.filter((p) => isScenarioAvailable(p) &&
    input.configuredPositions.includes(p.position));
  const own = available.find((p) => p.player_id === input.selectedNowId);
  if (!own) return { ...empty, status: "blocked", message: "Select a currently eligible comparison." };
  const ordered = available.flatMap((player) => {
    const market = scenarioMarketOrder(player);
    return market ? [{ player, market }] : [];
  }).sort((a, b) => a.market.value - b.market.value ||
    a.player.player_id.localeCompare(b.player.player_id));
  const unpricedCount = available.length - ordered.length;
  const selected = new Set<string>();
  const selections: ScenarioSelection[] = [];
  let cursor = 0;
  for (let pick = input.turn.currentPick; pick < window.nextOwnPick; pick++) {
    const slot = pickSlot(pick, input.turn.teams, input.turn.draftType);
    if (slot == null) return { ...empty, status: "blocked", message: "Cannot resolve an intervening draft slot." };
    let player: T;
    if (pick === window.ownPick) {
      if (selected.has(own.player_id)) {
        return { ...empty, status: "blocked", selections, unpricedCount,
          message: `${own.name} is taken before your upcoming turn in this scenario. Compare another player.` };
      }
      player = own;
    } else {
      while (ordered[cursor] && selected.has(ordered[cursor]!.player.player_id)) cursor++;
      const entry = ordered[cursor++];
      if (!entry) return { ...empty, status: "blocked", selections, unpricedCount,
        message: "Not enough market-ranked players to complete this scenario." };
      player = entry.player;
    }
    selected.add(player.player_id);
    selections.push({ pick, slot, playerId: player.player_id, name: player.name,
      position: player.position, kind: pick === window.ownPick ? "owner" : "opponent" });
  }
  return {
    status: "ready", message: "Opponents select in platform market order; backups remain possible.",
    window, selectedNowId: own.player_id, selections, unpricedCount,
    // Unpriced players remain on the hypothetical board. Their absence from
    // the removal order is a limitation, not evidence that they will survive.
    remainingIds: available.filter((p) => !selected.has(p.player_id)).map((p) => p.player_id),
  };
}

export function opponentWindowSlots(turn: DraftTurnInput, window: PickWindow) {
  const visits = new Map<number, number>();
  if (window.ownPick == null || window.nextOwnPick == null) return visits;
  for (let pick = window.ownPick + 1; pick < window.nextOwnPick; pick++) {
    const slot = pickSlot(pick, turn.teams, turn.draftType);
    if (slot != null) visits.set(slot, (visits.get(slot) ?? 0) + 1);
  }
  return visits;
}
