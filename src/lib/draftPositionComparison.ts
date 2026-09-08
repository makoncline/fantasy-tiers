import type { DraftValueMetrics } from "./draftValue";

/** Measured dominance, not a claim about future performance. Unknown risk is not zero risk. */
export function hasPositionQualityConflict(baseline: DraftValueMetrics, alternative: DraftValueMetrics) {
  return baseline.staticValue != null && alternative.staticValue != null &&
    alternative.staticValue > baseline.staticValue &&
    baseline.positionTier != null && baseline.positionTier > 0 &&
    alternative.positionTier != null && alternative.positionTier > 0 &&
    alternative.positionTier <= baseline.positionTier &&
    baseline.availability.classification !== "unknown" &&
    alternative.availability.classification !== "unknown" &&
    alternative.availability.penalty <= baseline.availability.penalty &&
    alternative.components.risk >= baseline.components.risk;
}

