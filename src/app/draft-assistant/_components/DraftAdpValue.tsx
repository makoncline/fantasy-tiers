"use client";

import { ecrToRoundPick } from "@/lib/util";
import { Badge } from "@/components/ui/badge";
import { getAdpTiming, type AdpTiming } from "@/lib/draftCardMetrics";

const TEXT_COLORS = {
  early: "text-amber-800 dark:text-amber-300",
  near: "text-muted-foreground",
  later: "text-emerald-800 dark:text-emerald-300",
  unknown: "text-muted-foreground",
} satisfies Record<AdpTiming["tone"], string>;
const BADGE_COLORS = {
  early: "border-amber-500/25 bg-amber-500/10",
  near: "border-border",
  later: "border-emerald-500/25 bg-emerald-500/10",
  unknown: "border-border",
} satisfies Record<AdpTiming["tone"], string>;

/** Same timing semantics on recommendation cards and sortable table cells. */
export function DraftAdpValue({ adp, pick, teams, compact = false, display }: {
  adp: number | null; pick: number | null; teams: number;
  compact?: boolean; display?: string | undefined;
}) {
  const timing = getAdpTiming(adp, pick, teams);
  const value = display ?? ecrToRoundPick(timing.adp, teams) ?? "—";
  const label = `ADP ${value} · ${timing.label}`;
  if (compact) return <span className={`whitespace-nowrap tabular-nums ${TEXT_COLORS[timing.tone]}`}
    title={timing.detail} aria-label={`${label}. ${timing.detail}`}>{value}</span>;
  return <Badge variant="outline" className={`tabular-nums ${TEXT_COLORS[timing.tone]} ${BADGE_COLORS[timing.tone]}`}
    title={timing.detail}>ADP {value}</Badge>;
}
