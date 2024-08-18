import { parse } from "csv-parse";
import fetch from "node-fetch";
import { getErrorMessage, normalizePlayerName } from "@/lib/util";

export const suffixForScoring: Record<string, string> = {
  PPR: "-PPR",
  HALF: "-HALF-PPR",
  STANDARD: "",
};

const parseCSV = async (rawStr: string) => {
  return new Promise<any[]>((resolve, reject) => {
    parse(rawStr, { columns: true, skip_empty_lines: true }, (err, records) => {
      if (err) reject(err);
      resolve(records);
    });
  });
};

export async function fetchRankings(scoring: string) {
  if (!(scoring.toUpperCase() in suffixForScoring)) {
    throw new Error("Invalid scoring type");
  }

  const url = `https://s3-us-west-1.amazonaws.com/fftiers/out/weekly-ALL${
    suffixForScoring[scoring.toUpperCase()]
  }.csv`;

  try {
    const response = await fetch(url);
    const csvText = await response.text();
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
