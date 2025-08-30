import fs from "fs";
import path from "path";
import { ScoringType } from "./schemas";

// Constants for file paths
export const RANKINGS_DIR = path.resolve("./public/data");
export const BORISCHEN_DIR = path.resolve(RANKINGS_DIR, "borischen");
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
  DEF: ["std"],
  RB: ["std", "ppr", "half"],
  WR: ["std", "ppr", "half"],
  TE: ["std", "ppr", "half"],
  FLEX: ["std", "ppr", "half"],
  ALL: ["std", "ppr", "half"],
};

// Ensure the directory exists
if (!fs.existsSync(RANKINGS_DIR)) {
  fs.mkdirSync(RANKINGS_DIR, { recursive: true });
}
if (!fs.existsSync(BORISCHEN_DIR)) {
  fs.mkdirSync(BORISCHEN_DIR, { recursive: true });
}

export const ROSTER_SLOT_TO_RANKING_DATA_ABBV: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
  FLEX: "FLX",
  ALL: "ALL",
};

async function fetchAndSaveRankings(
  fetchPosition: string,
  scoringType: ScoringType
) {
  const rankingDataAbbv = ROSTER_SLOT_TO_RANKING_DATA_ABBV[fetchPosition];
  const suffix =
    fetchPosition === "ALL"
      ? ALL_SUFFIX_FOR_SCORING[scoringType]
      : SUFFIX_FOR_SCORING[scoringType];
  const url = `https://s3-us-west-1.amazonaws.com/fftiers/out/weekly-${rankingDataAbbv}${suffix}.csv`;
  console.log(
    `Fetching rankings for ${fetchPosition} ${scoringType} from ${url}`
  );

  const filePath = path.resolve(
    BORISCHEN_DIR,
    `${fetchPosition}-${scoringType}-rankings-raw.csv`
  );
  const metadataFilePath = path.resolve(
    BORISCHEN_DIR,
    `${fetchPosition}-${scoringType}-metadata.json`
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
