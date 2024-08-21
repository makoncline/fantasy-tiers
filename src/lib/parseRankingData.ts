import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { z } from "zod";
import { SCORING_TYPES, ScoringType } from "./rankings";
import { normalizePlayerName } from "./util";
import { PositionEnum } from "./draftPicks";

// Constants for file paths
const RANKINGS_DIR = path.resolve("./public/data/rankings");
export const RAW_RANKINGS_FILE_PATHS: Record<ScoringType, string> = {
  std: path.resolve(RANKINGS_DIR, "std-rankings-raw.csv"),
  ppr: path.resolve(RANKINGS_DIR, "ppr-rankings-raw.csv"),
  half: path.resolve(RANKINGS_DIR, "half-rankings-raw.csv"),
};

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

async function parseAndSaveRankings(scoringType: ScoringType) {
  const filePath = RAW_RANKINGS_FILE_PATHS[scoringType];
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Raw rankings file for ${scoringType} does not exist. Please fetch the rankings first.`
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
      `${scoringType}-rankings.json`
    );
    fs.writeFileSync(outputFilePath, JSON.stringify(parsedData, null, 2));

    console.log(`Parsed and saved rankings for ${scoringType}`);
  } catch (error) {
    console.error(`Failed to parse rankings for ${scoringType}:`, error);
  }
}

async function parseAllRankings() {
  for (const scoringType of SCORING_TYPES) {
    await parseAndSaveRankings(scoringType);
  }
}

// Run the function if executed directly
if (require.main === module) {
  parseAllRankings();
}

export function getRankingLastUpdatedDate(
  scoringType: ScoringType
): string | null {
  const metadataFilePath = path.join(
    RANKINGS_DIR,
    `${scoringType}-metadata.json`
  );

  if (!fs.existsSync(metadataFilePath)) {
    console.error(`Metadata file for ${scoringType} does not exist.`);
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
