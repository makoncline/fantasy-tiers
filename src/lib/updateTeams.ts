import fs from "fs";
import path from "path";

async function fetchAndSaveTeams() {
  const url = "https://api.sleeper.app/teams/nfl";
  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "public",
    "data",
    "nfl-teams.json"
  );

  try {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("Failed to fetch team data from Sleeper API");

    const teamData = await response.json();

    // Ensure the directory exists before writing the file
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    fs.writeFileSync(filePath, JSON.stringify(teamData, null, 2));
    console.log(`Saved team data to ${filePath}`);
  } catch (error) {
    console.error("Failed to fetch and save team data:", error);
  }
}

if (require.main === module) {
  fetchAndSaveTeams();
}
