import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { z } from "zod";
import { normalizePlayerName } from "./util";
import { ScoringType, PositionEnum } from "./schemas";
import { POSITIONS_TO_SCORING_TYPES } from "./fetchRankingData";

// Constants for file paths
const RANKINGS_DIR = path.resolve("./public/data/rankings");
export const RAW_RANKINGS_FILE_PATHS: Record<
  string,
  Record<ScoringType, string>
> = {};

for (const [position, scoringTypes] of Object.entries(
  POSITIONS_TO_SCORING_TYPES
)) {
  RAW_RANKINGS_FILE_PATHS[position] = {} as Record<ScoringType, string>;
  for (const scoringType of scoringTypes) {
    RAW_RANKINGS_FILE_PATHS[position][scoringType] = path.resolve(
      RANKINGS_DIR,
      `${position}-${scoringType}-rankings-raw.csv`
    );
  }
}

// Define the Zod schema for the ranking row
const RankingRowSchema = z.object({
  "Player.Name": z.string(),
  Rank: z.coerce.number(), // Coerce the string into a number automatically
  Tier: z.coerce.number(), // Coerce the string into a number automatically
  Position: z.string(),
});

// Schema for the processed player data
export const RankingSchema = z.object({
  rank: z.number(),
  tier: z.number(),
  position: PositionEnum,
  name: z.string(),
});
export type Ranking = z.infer<typeof RankingSchema>;

// Parse the CSV file
async function parseCSV(filePath: string) {
  return new Promise<any[]>((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (err) => reject(err));
  });
}

async function parseAndSaveRankings(
  position: string,
  scoringType: ScoringType
) {
  const filePath = RAW_RANKINGS_FILE_PATHS[position][scoringType];
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Raw rankings file for ${position} ${scoringType} does not exist. Please fetch the rankings first.`
    );
  }

  try {
    const rawData = await parseCSV(filePath);

    // Use Zod to validate and parse the ranking data
    const parsedData = rawData
      .map((row) => {
        const validatedRow = RankingRowSchema.safeParse(row);
        if (!validatedRow.success) {
          console.error(
            `Failed to validate ranking row: ${validatedRow.error}`
          );
          return null;
        }

        const sanitizedName = normalizePlayerName(
          validatedRow.data["Player.Name"]
        );
        if (!sanitizedName) return null;

        const normalizedPosition =
          validatedRow.data.Position == "DST"
            ? "DEF"
            : validatedRow.data.Position;

        // Create the processed player object
        return RankingSchema.parse({
          rank: validatedRow.data.Rank,
          tier: validatedRow.data.Tier,
          position: normalizedPosition,
          name: sanitizedName,
        });
      })
      .filter((player) => player !== null);

    // Save the parsed data to a JSON file
    const outputFilePath = path.resolve(
      RANKINGS_DIR,
      `${position}-${scoringType}-rankings.json`
    );
    fs.writeFileSync(outputFilePath, JSON.stringify(parsedData, null, 2));

    console.log(`Parsed and saved rankings for ${position} ${scoringType}`);
  } catch (error) {
    console.error(
      `Failed to parse rankings for ${position} ${scoringType}:`,
      error
    );
  }
}

async function parseAllRankings() {
  for (const [position, scoringTypes] of Object.entries(
    POSITIONS_TO_SCORING_TYPES
  )) {
    for (const scoringType of scoringTypes) {
      await parseAndSaveRankings(position, scoringType);
    }
  }
}

// Run the function if executed directly
if (require.main === module) {
  parseAllRankings();
}

export function getRankingLastUpdatedDate(
  position: string,
  scoringType: ScoringType
): string | null {
  const metadataFilePath = path.join(
    RANKINGS_DIR,
    `${position}-${scoringType}-metadata.json`
  );

  if (!fs.existsSync(metadataFilePath)) {
    console.error(
      `Metadata file for ${position} ${scoringType} does not exist.`
    );
    return null;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataFilePath, "utf-8"));
    return metadata.lastModified || null;
  } catch (error) {
    console.error("Failed to read or parse the metadata file:", error);
    return null;
  }
}
