import type { DraftCandidate } from "../../src/lib/draftCandidate";
import type { DraftValueBoard, DraftValueMetrics } from "../../src/lib/draftValue";
import { hasPositionQualityConflict } from "../../src/lib/draftPositionComparison";

export const POSITION_POLICIES = ["baseline", "quality-guard", "highest-value", "tier-first", "position-timing"] as const;
export type PositionPolicy = (typeof POSITION_POLICIES)[number];

/** Offline only. Positions compete with the actual representative's own ADJ. */
export function selectPositionPolicy(board: DraftValueBoard<DraftCandidate>, policy: PositionPolicy) {
  if (policy === "baseline") return board.topRecommendation?.player;
  const metrics = (p: DraftCandidate) => board.metricsByPlayerId[p.player_id]!;
  const value = (p: DraftCandidate) => metrics(p).staticValue ?? -Infinity;
  const representatives = [...new Set(board.recommendations.map(p => p.position))].flatMap(position => {
    const pool = board.recommendations.filter(p => p.position === position);
    const lead = pool[0];
    if (!lead) return [];
    const m = metrics(lead);
    if (policy === "position-timing") {
      return [pool.reduce((best, p) => nonMarket(metrics(p)) > nonMarket(metrics(best)) ? p : best, lead)];
    }
    const choices = policy === "quality-guard" ? pool.filter(p => {
      const other = metrics(p);
      return hasPositionQualityConflict(m, other) &&
        m.components.timing > other.components.timing &&
        withoutTiming(other) >= withoutTiming(m);
    }) : policy === "highest-value" ? pool.filter(p =>
      metrics(p).availability.classification !== "unknown" &&
      metrics(p).availability.penalty <= m.availability.penalty &&
      metrics(p).components.risk >= m.components.risk) : pool;
    choices.sort((a, b) => {
      const tier = (p: DraftCandidate) => metrics(p).positionTier ?? Infinity;
      return (policy === "tier-first" ? tier(a) - tier(b) : 0) ||
        value(b) - value(a) || metrics(b).recommendationScore - metrics(a).recommendationScore;
    });
    return [choices[0] ?? lead];
  });
  // Ablation: remove explicit room demand and keep only the chosen player's
  // timing at the position-comparison stage. ADJ timing does not contain the
  // explicit demand term; the separate display urgency summary does.
  const score = (p: DraftCandidate) => metrics(p).recommendationScore - (policy === "position-timing" ? metrics(p).components.demand : 0);
  representatives.sort((a, b) => score(b) - score(a) ||
    board.recommendations.indexOf(a) - board.recommendations.indexOf(b));
  return representatives[0];
}

function withoutTiming(metrics: DraftValueMetrics) {
  return metrics.recommendationScore - metrics.components.timing;
}

function nonMarket(metrics: DraftValueMetrics) {
  return metrics.recommendationScore - metrics.components.timing - metrics.components.demand;
}
