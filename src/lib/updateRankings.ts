import fs from "fs";
import path from "path";
import { ScoringType, SCORING_TYPES } from "./schemas";

// Function to ensure a directory exists
function ensureDirectoryExistence(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Suffix for each scoring type in the URL
const suffixForScoring: Record<ScoringType, string> = {
  std: "",
  half: "-HALF-PPR",
  ppr: "-PPR",
};

// Function to fetch the raw CSV for a specific scoring type
async function fetchAndSaveRankings(scoringType: ScoringType) {
  const folderPath = path.join(__dirname, "..", "..", "public", "rankings");
  const filePath = path.join(folderPath, `${scoringType}-rankings.csv`);
  const metadataPath = path.join(folderPath, `${scoringType}-metadata.json`);

  const url = `https://s3-us-west-1.amazonaws.com/fftiers/out/weekly-ALL${suffixForScoring[scoringType]}.csv`;

  try {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch rankings for ${scoringType}`);

    const csvText = await response.text();
    const lastModified = response.headers.get("Last-Modified");

    // Ensure the directory exists before writing the file
    ensureDirectoryExistence(filePath);
    fs.writeFileSync(filePath, csvText);

    const metadata = {
      lastModified,
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`Saved ${scoringType} rankings and metadata.`);
  } catch (error) {
    console.error(
      `Failed to fetch and save rankings for ${scoringType}:`,
      error
    );
  }
}

// Main function to fetch and save raw CSVs for all scoring types
async function updateAllRankings() {
  for (const scoringType of SCORING_TYPES) {
    await fetchAndSaveRankings(scoringType);
  }
}

// Run the script if executed directly
if (require.main === module) {
  updateAllRankings();
}
