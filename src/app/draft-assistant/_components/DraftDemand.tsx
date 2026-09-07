"use client";
import { useDraftData } from "../_contexts/DraftDataContext";
import type { Position } from "@/lib/schemas";

export function DraftDemand({ position }: { position: Position | "FLEX" }) {
  const { draftContext } = useDraftData();
  const needs = draftContext?.room?.leagueStarterSlotsRemaining;
  if (!needs) return <span>Room needs unavailable</span>;
  if (position === "FLEX") return <span>Room open: {needs.FLEX} FLEX</span>;
  return <span title="Open starter slots across all teams. FLEX is shared by RB, WR and TE.">Room open: {needs[position]} {position === "DEF" ? "D/ST" : position}
    {["RB", "WR", "TE"].includes(position) ? ` · ${needs.FLEX} FLEX` : ""}</span>;
}
