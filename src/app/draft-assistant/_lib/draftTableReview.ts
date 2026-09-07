import { ROSTER_SLOTS, type DraftedPlayer, type Position, type RosterSlot } from "@/lib/schemas";
import type { PlayerWithPick } from "@/lib/types.draft";
import { calculateTeamNeedsAndCountsForSingleTeam } from "@/lib/draftHelpers";

type Slots = { slot: RosterSlot; player: DraftedPlayer | null }[];
export function slotEligibility(slots: Slots, position: Position) {
  const direct = slots.filter(s => s.slot === position);
  const flex = slots.filter(s => s.slot === "FLEX");
  const directIndex = direct.findIndex(s => !s.player);
  const flexIndex = flex.findIndex(s => !s.player);
  if (directIndex >= 0) return `Eligible for ${position === "DEF" ? "D/ST" : position}${direct.length > 1 ? directIndex + 1 : ""}`;
  if (["RB", "WR", "TE"].includes(position) && flexIndex >= 0) return `Eligible for FLEX${flex.length > 1 ? flexIndex + 1 : ""}`;
  return "Bench option — assess role";
}
export function scoreGap(value: number | null | undefined, reference: number | null | undefined) {
  if (value == null || reference == null) return "—";
  const gap = value - reference;
  return `${gap >= 0 ? "+" : ""}${gap.toFixed(1)}`;
}
const CONTEXT_LABELS = {
  timing: "Timing", starterNeed: "Starter need", construction: "Roster construction",
  onesie: "QB/TE policy", depth: "Depth/balance", demand: "League demand", risk: "Data/news risk",
} as const;
export function largestContext(player: PlayerWithPick) {
  const components = (["timing", "starterNeed", "construction", "onesie", "depth", "demand", "risk"] as const).flatMap(key => {
    const label = CONTEXT_LABELS[key];
    const value = player.draft_component_scores?.[key];
    return typeof value === "number" ? [{ label, value }] : [];
  }).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const top = components[0];
  return top ? `${top.label} ${scoreGap(top.value, 0)}` : "Context unavailable";
}
export function byeCoverage(slots: Slots) {
  const requirements: Record<RosterSlot, number> = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, K: 0, DEF: 0, BN: 0 };
  slots.forEach(s => requirements[s.slot]++);
  const players = slots.flatMap(s => s.player ? [s.player] : []);
  const normal = calculateTeamNeedsAndCountsForSingleTeam(players, requirements).positionNeeds;
  const weeks = [...new Set(players.flatMap(p => p.bye_week ? [p.bye_week] : []))];
  return weeks.flatMap(week => {
    const absent = players.filter(p => p.bye_week === week);
    if (absent.length < 2) return [];
    const remaining = players.filter(p => p.bye_week !== week);
    const needs = calculateTeamNeedsAndCountsForSingleTeam(remaining, requirements).positionNeeds;
    const added = ROSTER_SLOTS.filter(slot => slot !== "BN" && needs[slot] > normal[slot])
      .map(slot => `${needs[slot] - normal[slot]} ${slot === "DEF" ? "D/ST" : slot}`);
    return [{ week, absent: absent.map(p => p.name), added }];
  });
}
