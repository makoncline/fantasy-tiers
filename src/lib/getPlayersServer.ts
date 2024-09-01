import fs from "fs";
import { z } from "zod";
import { PlayerWithRankingsSchema, ScoringType } from "./schemas";
import { getPlayersByScoringType } from "./getPlayers";
import { getAggregateDataFilePath } from "./aggregatePlayerData";

// Update this line
export const ALL_AGGREGATE_PLAYER_DATA_FILE_PATH =
  getAggregateDataFilePath("ALL");

// Server-side function to load aggregate player data
export function loadAggregatePlayerDataServer(
  position: string = "ALL"
): Record<string, z.infer<typeof PlayerWithRankingsSchema>> {
  const filePath = getAggregateDataFilePath(position);
  const data = fs.readFileSync(filePath, "utf-8");
  return z.record(PlayerWithRankingsSchema).parse(JSON.parse(data));
}

// Server-side function to get players by scoring type
export function getPlayersByScoringTypeServer(scoringType: ScoringType) {
  const aggregatePlayerData = loadAggregatePlayerDataServer();
  return getPlayersByScoringType(scoringType, aggregatePlayerData);
}
