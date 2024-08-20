import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { ScoringType } from "./rankings";

const scoringTypes = ["std", "ppr", "half_ppr"];

const suffixForScoring: Record<ScoringType, string> = {
  std: "",
  ppr: "-PPR",
  half: "-HALF-PPR",
};

// Function to ensure a directory exists
function ensureDirectoryExistence(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Function to fetch the raw CSV for a specific scoring type
async function fetchAndSaveRankings(scoringType: ScoringType) {
  const folderPath = path.join(__dirname, "..", "..", "public", "rankings");
  const filePath = path.join(folderPath, `${scoringType}-rankings.csv`);

  const url = `https://s3-us-west-1.amazonaws.com/fftiers/out/weekly-ALL${suffixForScoring[scoringType]}.csv`;

  try {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch rankings for ${scoringType}`);
    const csvText = await response.text();

    // Ensure the directory exists before writing the file
    ensureDirectoryExistence(filePath);

    fs.writeFileSync(filePath, csvText);
    console.log(`Saved raw CSV for ${scoringType} rankings to ${filePath}`);
  } catch (error) {
    console.error(
      `Failed to fetch and save rankings for ${scoringType}:`,
      error
    );
  }
}

// Main function to fetch and save raw CSVs for all scoring types
async function updateAllRankings() {
  for (const scoringType of scoringTypes) {
    await fetchAndSaveRankings(scoringType);
  }
}

// Run the script if executed directly
if (require.main === module) {
  updateAllRankings();
}
