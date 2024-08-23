import fs from "fs";
import path from "path";
import { z } from "zod";
import { normalizePlayerName } from "./util";

// Constants
const PLAYER_API_URL = "https://api.sleeper.app/v1/players/nfl";
const PLAYER_DATA_FILE_PATH = path.resolve("./public/data/nfl-players.json");
const RAW_PLAYER_DATA_FILE_PATH = path.resolve(
  "./public/data/nfl-players-raw.json"
);

// Schema for the raw player data from Sleeper
const RawPlayerSchema = z.object({
  player_id: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  position: z.string().nullable(),
  team: z.string().nullable(),
});

// Schema for the parsed player data with normalized name
const PlayerSchema = z.object({
  player_id: z.string(),
  name: z.string(),
  position: z.string().nullable(),
  team: z.string().nullable(),
});

// Define types for both schemas
type RawPlayer = z.infer<typeof RawPlayerSchema>;
type Player = z.infer<typeof PlayerSchema>;

// Function to fetch player data from Sleeper API
async function fetchPlayerDataFromSleeper() {
  const response = await fetch(PLAYER_API_URL);

  if (!response.ok) {
    throw new Error("Failed to fetch player data from Sleeper API");
  }

  const rawData = await response.json();

  // Save the raw data to a file
  fs.writeFileSync(RAW_PLAYER_DATA_FILE_PATH, JSON.stringify(rawData, null, 2));
  console.log(`Raw player data saved to ${RAW_PLAYER_DATA_FILE_PATH}`);

  return rawData;
}

// Function to parse and save the processed player data
function parseAndSavePlayerData(rawData: any) {
  const parsedData: Record<string, Player> = {};

  for (const key in rawData) {
    try {
      const rawPlayer = RawPlayerSchema.parse(rawData[key]);
      const normalized_name = normalizePlayerName(
        `${rawPlayer.first_name} ${rawPlayer.last_name}`
      );
      parsedData[key] = PlayerSchema.parse({
        ...rawPlayer,
        name: normalized_name,
      });
    } catch (error) {
      console.error(`Failed to parse player with ID ${key}:`, error);
    }
  }

  // Save the parsed data to a file
  fs.writeFileSync(PLAYER_DATA_FILE_PATH, JSON.stringify(parsedData, null, 2));
  console.log(`Parsed player data saved to ${PLAYER_DATA_FILE_PATH}`);
}

// Main function to handle fetching, parsing, and saving
async function fetchAndSavePlayerData() {
  let rawData: unknown;

  // If the raw data file doesn't exist, fetch from Sleeper
  if (!fs.existsSync(RAW_PLAYER_DATA_FILE_PATH)) {
    rawData = await fetchPlayerDataFromSleeper();
  } else {
    // If the raw data file exists, load it
    console.log("Loading raw player data from file.");
    rawData = JSON.parse(fs.readFileSync(RAW_PLAYER_DATA_FILE_PATH, "utf-8"));
  }

  // Always reparse and save the parsed data
  parseAndSavePlayerData(rawData);
}

// Run the function if executed directly
if (require.main === module) {
  fetchAndSavePlayerData();
}
