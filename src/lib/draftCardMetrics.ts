import { usableMarketNumber } from "./draftLookaheadCore";

export type AdpTiming = {
  adp: number | null;
  delta: number | null;
  tone: "early" | "near" | "later" | "unknown";
  label: string;
  detail: string;
};

/** Display threshold only; half a league round is not a confidence band. */
export function getAdpTiming(adpInput: number | null | undefined, pick: number | null, teams: number): AdpTiming {
  const adp = usableMarketNumber(adpInput);
  if (adp == null || pick == null || !Number.isSafeInteger(pick) || pick < 1 ||
      !Number.isSafeInteger(teams) || teams < 1) {
    return { adp, delta: null, tone: "unknown", label: "Timing unknown",
      detail: "ADP or the upcoming selection is unavailable. This is not a player-quality signal." };
  }
  const rawDelta = pick - adp;
  const delta = Math.round(rawDelta * 10) / 10;
  const tone = rawDelta <= -teams / 2 ? "early" : rawDelta >= teams / 2 ? "later" : "near";
  const label = tone === "early" ? "Early" : tone === "later" ? "Past ADP" : "Near ADP";
  const distance = Math.abs(delta).toFixed(1);
  return {
    adp, delta, tone, label,
    detail: `Pick ${pick} is ${distance} picks ${delta < 0 ? "before" : "after"} ADP ${adp.toFixed(1)}. Color shows market timing, not player quality or survival probability.`,
  };
}

export function formatDraftMetric(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? value.toFixed(1) : "—";
}

export function formatMetricDifference(value: number | null | undefined, reference: number | null | undefined) {
  if (value == null || reference == null || !Number.isFinite(value) || !Number.isFinite(reference)) return "—";
  const delta = Math.round((value - reference) * 10) / 10;
  if (delta === 0) return "Same";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}`;
}

export function overallTier(player: { tier_level?: number | null; tier?: number | null }) {
  const value = player.tier_level ?? player.tier;
  return value != null && Number.isInteger(value) && value > 0 ? value : null;
}

export function tierDifference(tier: number | null, reference: number | null) {
  if (tier == null || reference == null) return "—";
  const delta = tier - reference;
  return delta === 0 ? "Same tier" : `${Math.abs(delta)} tier${Math.abs(delta) === 1 ? "" : "s"} ${delta < 0 ? "better" : "worse"}`;
}
