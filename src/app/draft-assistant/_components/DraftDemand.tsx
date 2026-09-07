"use client";
import { useDraftData } from "../_contexts/DraftDataContext";
import type { Position } from "@/lib/schemas";

export function DraftDemand({ position }: { position: Position | "FLEX" }) {
  const { draftContext } = useDraftData();
  const needs = draftContext?.room?.leagueStarterSlotsRemaining;
  if (!needs) return <span>Room starter counts unavailable</span>;
  if (position === "FLEX") return <span>{needs.FLEX} shared FLEX slots open (RB/WR/TE)</span>;
  return <span>{needs[position]} direct {position === "DEF" ? "D/ST" : position} starter slots open
    {["RB", "WR", "TE"].includes(position) ? ` · ${needs.FLEX} shared FLEX slots (RB/WR/TE, counted once)` : ""}
    . Counts include your team; they do not predict opponent picks.</span>;
}
