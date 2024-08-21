import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { SCORING_TYPES, ScoringType } from "./rankings";

// Constants for file paths
const RANKINGS_DIR = path.resolve("./public/data/rankings");
export const RAW_RANKINGS_FILE_PATHS: Record<ScoringType, string> = {
  std: path.resolve(RANKINGS_DIR, "std-rankings-raw.csv"),
  ppr: path.resolve(RANKINGS_DIR, "ppr-rankings-raw.csv"),
  half: path.resolve(RANKINGS_DIR, "half-rankings-raw.csv"),
};
const SUFFIX_FOR_SCORING: Record<ScoringType, string> = {
  std: "",
  half: "-HALF-PPR",
  ppr: "-PPR",
};

// Ensure the directory exists
if (!fs.existsSync(RANKINGS_DIR)) {
  fs.mkdirSync(RANKINGS_DIR, { recursive: true });
}

async function fetchAndSaveRankings(scoringType: ScoringType) {
  const url = `https://s3-us-west-1.amazonaws.com/fftiers/out/weekly-ALL${SUFFIX_FOR_SCORING[scoringType]}.csv`;
  const filePath = RAW_RANKINGS_FILE_PATHS[scoringType];
  const metadataFilePath = path.resolve(
    RANKINGS_DIR,
    `${scoringType}-metadata.json`
  );

  try {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch rankings for ${scoringType}`);

    const csvText = await response.text();
    const lastModified =
      response.headers.get("Last-Modified") || new Date().toISOString();

    // Save the raw CSV data
    fs.writeFileSync(filePath, csvText);

    // Save metadata with the last modified date
    const metadata = { lastModified };
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));

    console.log(`Saved raw CSV and metadata for ${scoringType} rankings.`);
  } catch (error) {
    console.error(
      `Failed to fetch and save rankings for ${scoringType}:`,
      error
    );
  }
}

async function fetchAllRankings() {
  for (const scoringType of SCORING_TYPES) {
    await fetchAndSaveRankings(scoringType);
  }
}

// Run the function if executed directly
if (require.main === module) {
  fetchAllRankings();
}
