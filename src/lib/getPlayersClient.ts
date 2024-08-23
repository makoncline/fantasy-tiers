import { z } from "zod";
import { getPlayersByScoringType } from "./getPlayerss";
import { PlayerWithRankingsSchema, ScoringType } from "./schemas";

const AGGREGATE_PLAYER_DATA_URL = "/data/aggregate-player-data.json";

// Client-side version of loadAggregatePlayerData
export async function loadAggregatePlayerDataClient() {
  const response = await fetch(AGGREGATE_PLAYER_DATA_URL);
  if (!response.ok) {
    throw new Error("Failed to load aggregate player data");
  }
  const data = await response.json();
  return z.record(PlayerWithRankingsSchema).parse(data);
}

// Client-side function to get players by scoring type
export async function getPlayersByScoringTypeClient(scoringType: ScoringType) {
  const aggregatePlayerData = await loadAggregatePlayerDataClient();
  return getPlayersByScoringType(scoringType, aggregatePlayerData);
}
