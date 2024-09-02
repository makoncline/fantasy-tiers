import { z } from "zod";
import { getPlayersByScoringType } from "./getPlayers";
import {
  DraftedPlayer,
  PlayerWithRankingsSchema,
  RosterSlot,
  ScoringType,
} from "./schemas";

// Remove the ROSTER_SLOT_TO_FETCH_MAP constant from here

// New function to get the URL path for client-side access
export function getAggregateDataUrlPath(position: RosterSlot | "ALL"): string {
  return `/data/${position}-aggregate-players.json`;
}

// Client-side function to load aggregate player data
export async function loadAggregatePlayerDataClient(
  position: RosterSlot | "ALL" = "ALL"
): Promise<Record<string, z.infer<typeof PlayerWithRankingsSchema>>> {
  const url = getAggregateDataUrlPath(position);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load aggregate player data for ${position}`);
  }
  const data = await response.json();
  return z.record(PlayerWithRankingsSchema).parse(data);
}

// Client-side function to get players by scoring type
export async function getPlayersByScoringTypeClient(
  scoringType: ScoringType,
  position: RosterSlot | "ALL" = "ALL"
) {
  const aggregatePlayerData = await loadAggregatePlayerDataClient(position);
  return getPlayersByScoringType(scoringType, aggregatePlayerData);
}
