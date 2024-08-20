import { parse } from "csv-parse";
import { getErrorMessage, normalizePlayerName } from "@/lib/util";
import { z } from "zod";
import fs from "fs";
import path from "path";

const scoringType = ["std", "ppr", "half"] as const;
export const scoringTypeSchema = z.enum(scoringType);
export type ScoringType = z.infer<typeof scoringTypeSchema>;

export const suffixForScoring: Record<ScoringType, string> = {
  std: "std-rankings.csv",
  ppr: "ppr-rankings.csv",
  half: "half_ppr-rankings.csv",
};

const parseCSV = async (rawStr: string) => {
  // Assuming you have the CSV parsing logic here
  // You can use your existing CSV parsing logic
  return new Promise<any[]>((resolve, reject) => {
    parse(rawStr, { columns: true, skip_empty_lines: true }, (err, records) => {
      if (err) reject(err);
      resolve(records);
    });
  });
};

export async function fetchRankings(scoring: ScoringType) {
  const fileName = `${suffixForScoring[scoring]}`;
  const filePath = path.resolve("./public/rankings", fileName);

  console.log("~", filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Rankings file for ${scoring} does not exist. Please run the fetch-rankings script first.`
    );
  }

  try {
    const csvText = fs.readFileSync(filePath, "utf-8");
    const parsedData: any[] = await parseCSV(csvText);

    const map: Record<
      string,
      { rank: number; tier: number; position: string; name: string }
    > = {};

    parsedData.forEach((row) => {
      const sanitizedName = normalizePlayerName(row["Player.Name"]);
      if (sanitizedName) {
        // Parse and validate the tier
        const tier = parseInt(row["Tier"], 10);
        if (isNaN(tier)) {
          console.error(
            `Invalid tier for player ${sanitizedName}: ${row["Tier"]}`
          );
        }

        // Parse and validate the rank
        const rank = parseInt(row["Rank"], 10);
        if (isNaN(rank)) {
          console.error(
            `Invalid rank for player ${sanitizedName}: ${row["Rank"]}`
          );
        }

        map[sanitizedName] = {
          rank: isNaN(rank) ? 0 : rank, // Default to 0 if rank is not a valid number
          tier: isNaN(tier) ? 0 : tier, // Default to 0 if tier is not a valid number
          position: row["Position"] || "Unknown", // Assuming "Position" is a column in the CSV
          name: sanitizedName,
        };
      }
    });

    return map;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
