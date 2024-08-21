import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// Constants
const PLAYER_API_URL = "https://api.sleeper.app/v1/players/nfl";
export const RAW_PLAYER_DATA_FILE_PATH = path.resolve(
  "./public/data/nfl-players-raw.json"
);

// Function to fetch player data from Sleeper API
export async function fetchPlayerData() {
  const response = await fetch(PLAYER_API_URL);

  if (!response.ok) {
    throw new Error("Failed to fetch player data from Sleeper API");
  }

  const rawData = await response.json();

  // Save the raw data to a file (overwrites existing file)
  fs.writeFileSync(RAW_PLAYER_DATA_FILE_PATH, JSON.stringify(rawData, null, 2));
  console.log(`Raw player data saved to ${RAW_PLAYER_DATA_FILE_PATH}`);

  return rawData;
}

// Main function to handle fetching
export async function fetchAndSavePlayerData() {
  const rawData = await fetchPlayerData();
  return rawData;
}

// Run the function if executed directly
if (require.main === module) {
  fetchAndSavePlayerData();
}
