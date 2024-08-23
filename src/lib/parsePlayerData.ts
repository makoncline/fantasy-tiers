import fs from "fs";
import path from "path";
import { z } from "zod";
import { normalizePlayerName } from "./util";
import { RAW_PLAYER_DATA_FILE_PATH } from "./fetchPlayerData";
import { PositionEnum } from "./schemas";

// Schema for the raw player data from Sleeper
const RawPlayerSchema = z.object({
  player_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  position: z.string().nullable(),
  team: z.string().nullable(),
});

// Schema for the parsed player data with normalized name
export const SleeperPlayerSchema = z.object({
  player_id: z.string(),
  name: z.string(),
  position: PositionEnum,
  team: z.string().nullable(),
});

// Define types for both schemas
export type SleeperPlayer = z.infer<typeof SleeperPlayerSchema>;

// Constants
export const PLAYER_DATA_FILE_PATH = path.resolve(
  "./public/data/nfl-players.json"
);

// Function to parse and save the processed player data
export function parseAndSavePlayerData(rawData: any) {
  const parsedData: Record<string, SleeperPlayer> = {};

  for (const key in rawData) {
    try {
      const rawPlayer = RawPlayerSchema.parse(rawData[key]);
      const normalized_name = normalizePlayerName(
        `${rawPlayer.first_name ?? ""} ${rawPlayer.last_name ?? ""}`.trim()
      );
      parsedData[key] = SleeperPlayerSchema.parse({
        ...rawPlayer,
        name: normalized_name,
      });
    } catch (error) {
      console.error(`Failed to parse player with ID ${key}:`, error);
    }
  }

  // Save the parsed data to a file (overwrites existing file)
  fs.writeFileSync(PLAYER_DATA_FILE_PATH, JSON.stringify(parsedData, null, 2));
  console.log(`Parsed player data saved to ${PLAYER_DATA_FILE_PATH}`);
}

// Main function to reparse and save the data
export function processPlayerData() {
  const rawData = JSON.parse(
    fs.readFileSync(RAW_PLAYER_DATA_FILE_PATH, "utf-8")
  );
  parseAndSavePlayerData(rawData);
}

// Run the function if executed directly
if (require.main === module) {
  processPlayerData();
}
