"use client";
import { useDraftData } from "../_contexts/DraftDataContext";
import { normalizePlayerName } from "@/lib/util";

/** Keep source spelling for display; normalized names remain matching keys. */
export function usePlayerDisplayName() {
  const { sourceHealth } = useDraftData();
  return (playerId: string, name: string) => sourceHealth?.sleeperPlayers.find(p => p.playerId === playerId)?.name
    ?? sourceHealth?.fantasyProsPlayers.find(p => p.normalizedName === normalizePlayerName(name))?.name
    ?? name;
}
export function PlayerDisplayName({ playerId, name }: { playerId: string; name: string }) {
  return usePlayerDisplayName()(playerId, name);
}
