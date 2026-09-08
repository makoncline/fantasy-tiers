import type { DraftCandidate } from "./draftCandidate";
import type { DraftScoringRules, DraftRosterSlots } from "./draftLeagueConfig";
import type { StarterAwareValueResult } from "./beerPlusStrategy";
import type { DraftValueBoard, DraftValueBoardInput, DraftValueMetrics } from "./draftValue";
import type { RosterSlot } from "./schemas";

export type DraftChoiceSnapshot = {
  draftId: string;
  scoringRules: DraftScoringRules;
  projectionUpdatedAt: string | null;
  boardInput: DraftValueBoardInput<DraftCandidate>;
  values: StarterAwareValueResult;
  sleeperValues?: StarterAwareValueResult;
  rosterSlots: DraftRosterSlots;
};

export const CHOICE_COMPONENT_LABELS = {
  value: "Base value contribution",
  timing: "Timing",
  starterNeed: "Starter need",
  construction: "Roster construction",
  onesie: "QB/TE policy",
  depth: "Roster depth and balance",
  demand: "Room demand",
  risk: "Risk",
  rankingOrder: "Selected ranking order",
};

export function choiceRosterFit(
  player: Pick<DraftCandidate, "position">,
  needs: Partial<Record<RosterSlot, number>>,
) {
  const after = { ...needs };
  const slot = (after[player.position] ?? 0) > 0 ? player.position
    : ["RB", "WR", "TE"].includes(player.position) && (after.FLEX ?? 0) > 0 ? "FLEX"
    : "BN";
  after[slot] = Math.max(0, (after[slot] ?? 0) - 1);
  const open = Object.entries(after).filter(([key, count]) => key !== "BN" && count > 0)
    .map(([key, count]) => `${count} ${key}`);
  return {
    slot,
    purpose: slot === "BN" ? `${player.position} coverage` : `${slot} starter slot`,
    remaining: open.length ? `Still open: ${open.join(", ")}.` : "All starting slots are covered.",
  };
}

export type DraftChoice = {
  player: DraftCandidate;
  metrics: DraftValueMetrics;
  reason: string;
};

// This set is for inspection. Tier membership is a display rule, not an error band.
// No score or eligibility is changed here. Read the full canonical eligible pool.
export function buildDraftChoices(board: DraftValueBoard<DraftCandidate>) {
  const lean = board.topRecommendation?.player;
  if (!lean) return [];
  const metrics = (p: DraftCandidate) => board.metricsByPlayerId[p.player_id]!;
  const value = (p: DraftCandidate) => metrics(p).staticValue ?? -Infinity;
  const byValue = [...board.recommendations].sort((a, b) => value(b) - value(a));
  const choices: DraftChoice[] = [{ player: lean, metrics: metrics(lean), reason: "Current adjusted recommendation" }];
  const add = (player: DraftCandidate | undefined, reason: string) => {
    if (player && !choices.some((c) => c.player.player_id === player.player_id)) {
      choices.push({ player, metrics: metrics(player), reason });
    }
  };
  add(byValue[0], "Highest base value in the eligible pool");
  for (const player of board.recommendations) {
    if (player.player_id === lean.player_id) continue;
    const bestAtPosition = byValue.find((p) => p.position === player.position);
    const sameOverallTier = player.tier_level != null && player.tier_level > 0 && player.tier_level === lean.tier_level;
    const samePositionTier = player.position === lean.position && player.position_tier_level != null &&
      player.position_tier_level > 0 && player.position_tier_level === lean.position_tier_level;
    if (player === bestAtPosition && (sameOverallTier || value(player) >= value(lean))) {
      add(player, "Best base value at this position; shares the current tier or has higher value");
    } else if (samePositionTier && choices.filter((c) => c.player.position === lean.position).length < 2) {
      add(player, "Same position tier; a nearby option to inspect");
    }
  }
  // Put a distinct position before a second same-position option, without adding weak fillers.
  const alternative = choices.slice(1).find((c) => c.player.position !== lean.position);
  if (alternative && choices.indexOf(alternative) > 2) {
    choices.splice(choices.indexOf(alternative), 1);
    choices.splice(2, 0, alternative);
  }
  return choices;
}

export function choiceContributionDifference(lean: DraftValueMetrics, other: DraftValueMetrics) {
  return (["value", "timing", "starterNeed", "construction", "onesie", "depth", "demand", "risk", "rankingOrder"] as const)
    .map((key) => ({ key, label: CHOICE_COMPONENT_LABELS[key], value: lean.components[key] - other.components[key] }))
    .sort((a, b) => b.value - a.value);
}
