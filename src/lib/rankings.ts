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
      { rank: number; tier: string; position: string; name: string }
    > = {};
    parsedData.forEach((row, index) => {
      const sanitizedName = normalizePlayerName(row["Player.Name"]);
      if (sanitizedName) {
        map[sanitizedName] = {
          rank: index + 1, // Assuming the index can be used as rank
          tier: row["Tier"] || "Unknown", // Assuming "Tier" is a column in the CSV
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
