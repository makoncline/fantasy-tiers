import fs from "fs";
import path from "path";
import { z } from "zod";
import { RAW_TEAM_DATA_FILE_PATH } from "./fetchTeamData";

// Schema for the raw team data from Sleeper
const RawTeamSchema = z.object({
  name: z.string(),
  metadata: z.object({
    bye_week: z.string(),
  }),
  team: z.string(),
});

// Schema for the parsed team data
export const TeamSchema = z.object({
  team: z.string(),
  name: z.string(),
  bye_week: z.string(),
});

// Define types for both schemas
type RawTeam = z.infer<typeof RawTeamSchema>;
export type Team = z.infer<typeof TeamSchema>;

// Constants
export const TEAM_DATA_FILE_PATH = path.resolve("./public/data/nfl-teams.json");

// Function to parse and save the processed team data
export function parseAndSaveTeamData(rawData: unknown) {
  const parsedData: Record<string, Team> = {};
  const teams = rawData as unknown[];

  teams.forEach((team: unknown) => {
    try {
      const rawTeam = RawTeamSchema.parse(team);
      const parsedTeam = TeamSchema.parse({
        team: rawTeam.team,
        name: rawTeam.name,
        bye_week: rawTeam.metadata.bye_week,
      });

      parsedData[rawTeam.team] = parsedTeam;
    } catch (error) {
      console.error(
        `Failed to parse team ${
          ((team as Record<string, unknown>)?.name as string) || "unknown"
        }:`,
        error
      );
    }
  });

  // Save the parsed data to a file (overwrites existing file)
  fs.writeFileSync(TEAM_DATA_FILE_PATH, JSON.stringify(parsedData, null, 2));
  console.log(`Parsed team data saved to ${TEAM_DATA_FILE_PATH}`);
}

// Main function to reparse and save the data
export function processTeamData() {
  const rawData = JSON.parse(fs.readFileSync(RAW_TEAM_DATA_FILE_PATH, "utf-8"));
  parseAndSaveTeamData(rawData);
}

// Run the function if executed directly
if (require.main === module) {
  processTeamData();
}
