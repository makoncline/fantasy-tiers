import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// Constants
const TEAM_API_URL = "https://api.sleeper.app/teams/nfl";
export const RAW_TEAM_DATA_FILE_PATH = path.resolve(
  "./public/data/nfl-teams-raw.json"
);

// Function to fetch team data from Sleeper API
export async function fetchTeamData() {
  const response = await fetch(TEAM_API_URL);

  if (!response.ok) {
    throw new Error("Failed to fetch team data from Sleeper API");
  }

  const rawData = await response.json();

  // Save the raw data to a file (overwrites existing file)
  fs.writeFileSync(RAW_TEAM_DATA_FILE_PATH, JSON.stringify(rawData, null, 2));
  console.log(`Raw team data saved to ${RAW_TEAM_DATA_FILE_PATH}`);

  return rawData;
}

// Main function to handle fetching
export async function fetchAndSaveTeamData() {
  const rawData = await fetchTeamData();
  return rawData;
}

// Run the function if executed directly
if (require.main === module) {
  fetchAndSaveTeamData();
}
