import type { DraftValueMetrics } from "@/lib/draftValue";

/** Display the recorded rule; do not infer a new scoring explanation. */
export function adjustmentLabel(key: string, fallback: string, metric: Pick<DraftValueMetrics, "components" | "reasons">) {
  if (key !== "onesie") return fallback;
  const codes = metric.components.onesie < 0
    ? ["ONESIE_WAIT", "ONESIE_PRICE_REACH", "QB_TOO_EARLY", "NON_ELITE_TE_TOO_EARLY", "TE_TOO_EARLY"]
    : ["ELITE_QB_STARTER", "ELITE_TE_STARTER", "STARTER_DEADLINE"];
  for (const code of codes) {
    const reason = metric.reasons.find(reason => reason.code === code);
    if (reason) return reason.label;
  }
  return fallback;
}
