import fs from "fs";
import path from "path";
import { ScoringType } from "./schemas";

// Constants for file paths
export const RANKINGS_DIR = path.resolve("./public/data/rankings");
export const RAW_RANKINGS_FILE_PATHS: Record<ScoringType, string> = {
  std: path.resolve(RANKINGS_DIR, "std-rankings-raw.csv"),
  ppr: path.resolve(RANKINGS_DIR, "ppr-rankings-raw.csv"),
  half: path.resolve(RANKINGS_DIR, "half-rankings-raw.csv"),
};
const SUFFIX_FOR_SCORING: Record<ScoringType, string> = {
  std: "",
  half: "-HALF",
  ppr: "-PPR",
};

// Special case for ALL position
const ALL_SUFFIX_FOR_SCORING: Record<ScoringType, string> = {
  std: "",
  half: "-HALF-PPR",
  ppr: "-PPR",
};

export const POSITIONS_TO_SCORING_TYPES: Record<string, ScoringType[]> = {
  QB: ["std"],
  K: ["std"],
  DST: ["std"],
  RB: ["std", "ppr", "half"],
  WR: ["std", "ppr", "half"],
  TE: ["std", "ppr", "half"],
  FLX: ["std", "ppr", "half"],
  ALL: ["std", "ppr", "half"],
};

// Ensure the directory exists
if (!fs.existsSync(RANKINGS_DIR)) {
  fs.mkdirSync(RANKINGS_DIR, { recursive: true });
}

export const FETCH_TO_ROSTER_SLOT_MAP: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DST: "DEF",
  FLX: "FLEX",
  ALL: "ALL",
};

async function fetchAndSaveRankings(
  fetchPosition: string,
  scoringType: ScoringType
) {
  const suffix =
    fetchPosition === "ALL"
      ? ALL_SUFFIX_FOR_SCORING[scoringType]
      : SUFFIX_FOR_SCORING[scoringType];
  const url = `https://s3-us-west-1.amazonaws.com/fftiers/out/weekly-${fetchPosition}${suffix}.csv`;
  console.log(
    `Fetching rankings for ${fetchPosition} ${scoringType} from ${url}`
  );

  const rosterSlotPosition = FETCH_TO_ROSTER_SLOT_MAP[fetchPosition];
  const filePath = path.resolve(
    RANKINGS_DIR,
    `${rosterSlotPosition}-${scoringType}-rankings-raw.csv`
  );
  const metadataFilePath = path.resolve(
    RANKINGS_DIR,
    `${rosterSlotPosition}-${scoringType}-metadata.json`
  );

  try {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Failed to fetch rankings for ${fetchPosition} ${scoringType}`
      );

    const csvText = await response.text();
    const lastModified =
      response.headers.get("Last-Modified") || new Date().toISOString();

    // Save the raw CSV data
    fs.writeFileSync(filePath, csvText);

    // Save metadata with the last modified date
    const metadata = { lastModified };
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));

    console.log(
      `Saved raw CSV and metadata for ${fetchPosition} ${scoringType} rankings.`
    );
  } catch (error) {
    console.error(
      `Failed to fetch and save rankings for ${fetchPosition} ${scoringType}:`,
      error
    );
  }
}

async function fetchAllRankings() {
  for (const [position, scoringTypes] of Object.entries(
    POSITIONS_TO_SCORING_TYPES
  )) {
    for (const scoringType of scoringTypes) {
      await fetchAndSaveRankings(position, scoringType);
    }
  }
}

// Run the function if executed directly
if (require.main === module) {
  fetchAllRankings();
}
