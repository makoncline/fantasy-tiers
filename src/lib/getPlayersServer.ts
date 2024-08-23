import fs from "fs";
import path from "path";
import { z } from "zod";
import { getPlayersByScoringType } from "./getPlayerss";
import { PlayerWithRankingsSchema, ScoringType } from "./schemas";

export const AGGREGATE_PLAYER_DATA_FILE_PATH = path.resolve(
  "./public/data/aggregate-player-data.json"
);

// Server-side function to load aggregate player data
export function loadAggregatePlayerDataServer() {
  const data = fs.readFileSync(AGGREGATE_PLAYER_DATA_FILE_PATH, "utf-8");
  return z.record(PlayerWithRankingsSchema).parse(JSON.parse(data));
}

// Server-side function to get players by scoring type
export function getPlayersByScoringTypeServer(scoringType: ScoringType) {
  const aggregatePlayerData = loadAggregatePlayerDataServer();
  return getPlayersByScoringType(scoringType, aggregatePlayerData);
}
