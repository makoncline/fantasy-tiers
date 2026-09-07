"use client";
import { useDraftData } from "../_contexts/DraftDataContext";
import type { Position } from "@/lib/schemas";

export function DraftDemand({ position }: { position: Position | "FLEX" }) {
  const { draftContext, userRosterSlots, draftDetails } = useDraftData();
  const needs = draftContext?.room?.leagueStarterSlotsRemaining;
  if (!needs) return <span>Room needs unavailable</span>;
  const total = (draftDetails?.settings.teams ?? 0) * userRosterSlots.filter(slot => slot.slot === position).length;
  return <span title="Unfilled starting slots across the league. FLEX demand is shared by RB, WR and TE.">{position === "FLEX" ? "Open FLEX" : "Open starters"} {needs[position]}/{total || "—"}</span>;
}
