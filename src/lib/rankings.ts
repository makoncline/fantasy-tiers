import { parse } from "csv-parse";
import { getErrorMessage, normalizePlayerName } from "@/lib/util";
import fs from "fs";
import path from "path";
import { ScoringType } from "./schemas";

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
  const fileName = `${scoring}-rankings.csv`;
  const metadataFileName = `${scoring}-metadata.json`;
  const rankingsDir = path.resolve("./public/rankings");
  const filePath = path.resolve(rankingsDir, fileName);
  const metadataPath = path.resolve(rankingsDir, metadataFileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Rankings file for ${scoring} does not exist. Please run the fetch-rankings script first.`
    );
  }
  if (!fs.existsSync(metadataPath)) {
    throw new Error(
      `Metadata file for ${scoring} does not exist. Please run the fetch-rankings script first.`
    );
  }

  try {
    const csvText = fs.readFileSync(filePath, "utf-8");
    const parsedData: any[] = await parseCSV(csvText);

    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    const lastModified = metadata.lastModified;

    const players: Record<
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

        players[sanitizedName] = {
          rank: isNaN(rank) ? 0 : rank, // Default to 0 if rank is not a valid number
          tier: isNaN(tier) ? 0 : tier, // Default to 0 if tier is not a valid number
          position: row["Position"] || "Unknown", // Assuming "Position" is a column in the CSV
          name: sanitizedName,
        };
      }
    });

    return { lastModified, players };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
