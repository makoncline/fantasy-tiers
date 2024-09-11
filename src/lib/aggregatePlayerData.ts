import fs from "fs";
import path from "path";
import { z } from "zod";
import { PLAYER_DATA_FILE_PATH, SleeperPlayerSchema } from "./parsePlayerData";
import { TEAM_DATA_FILE_PATH, TeamSchema } from "./parseTeamData";
import { normalizePlayerName } from "./util";
import {
  PlayerWithRankingsSchema,
  RankTierSchema,
  ScoringType,
} from "./schemas";
import { POSITIONS_TO_SCORING_TYPES, RANKINGS_DIR } from "./fetchRankingData";
import { FLEX_POSITIONS } from "./draftHelpers";

export const AGGREGATE_DATA_DIR = path.resolve(process.cwd(), "public/data");

// Add this function to get the aggregate data file path based on position
export function getAggregateDataFilePath(position: string): string {
  return path.join(AGGREGATE_DATA_DIR, `${position}-aggregate-players.json`);
}

function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Function to aggregate all parsed data into the final player data
function aggregatePlayerData() {
  console.log("All positions:", Object.keys(POSITIONS_TO_SCORING_TYPES));

  // Load and parse the parsed player data
  const playerData = z
    .record(SleeperPlayerSchema)
    .parse(JSON.parse(fs.readFileSync(PLAYER_DATA_FILE_PATH, "utf-8")));

  // Load and parse the parsed team data to map bye weeks
  const teamData = z
    .record(TeamSchema)
    .parse(JSON.parse(fs.readFileSync(TEAM_DATA_FILE_PATH, "utf-8")));

  Object.entries(POSITIONS_TO_SCORING_TYPES).forEach(
    ([position, scoringTypes]) => {
      console.log(`Starting to process position: ${position}`);

      if (position === "undefined" || !position) {
        console.error("Invalid position encountered:", position);
        return; // Skip this iteration
      }

      // Load and parse rankings for each scoring type and transform to an object keyed by player name
      const rankingsData: Record<
        ScoringType,
        Record<string, z.infer<typeof RankTierSchema>>
      > = scoringTypes.reduce((acc, scoringType) => {
        const filePath = path.resolve(
          RANKINGS_DIR,
          `${position}-${scoringType}-rankings.json`
        );
        if (!fs.existsSync(filePath)) {
          console.error(
            `Rankings file for ${position} ${scoringType} does not exist.`
          );
          return acc;
        }
        const parsedRankings = z
          .array(
            z.object({
              rank: z.number(),
              tier: z.number(),
              name: z.string(),
            })
          )
          .parse(JSON.parse(fs.readFileSync(filePath, "utf-8")));

        // Convert array to an object keyed by normalized player name
        const rankingsByPlayerName = parsedRankings.reduce(
          (nameAcc, playerRanking) => {
            const normalizedName = normalizePlayerName(playerRanking.name);
            nameAcc[normalizedName] = {
              rank: playerRanking.rank,
              tier: playerRanking.tier,
            };
            return nameAcc;
          },
          {} as Record<string, z.infer<typeof RankTierSchema>>
        );

        acc[scoringType] = rankingsByPlayerName;
        return acc;
      }, {} as Record<ScoringType, Record<string, z.infer<typeof RankTierSchema>>>);

      console.log(`Processing ${position}`);

      const finalPlayerData: Record<
        string,
        z.infer<typeof PlayerWithRankingsSchema>
      > = {};

      let playerCount = 0;

      // Process all players in playerData instead of only ranked players
      Object.values(playerData).forEach((player) => {
        if (position === "ALL") {
          // No filtering for ALL
        } else if (position === "FLEX") {
          if (!FLEX_POSITIONS.includes(player.position as any)) {
            return;
          }
        } else {
          if (player.position !== position) {
            return;
          }
        }

        playerCount++;

        const playerName = normalizePlayerName(player.name);

        // Build the rankings by scoring type
        const rankingsByScoringType = {
          std: scoringTypes.includes("std")
            ? rankingsData.std?.[playerName] || null
            : null,
          ppr: scoringTypes.includes("ppr")
            ? rankingsData.ppr?.[playerName] || null
            : null,
          half: scoringTypes.includes("half")
            ? rankingsData.half?.[playerName] || null
            : null,
        };

        // Assemble the final player object
        const finalPlayer: z.infer<typeof PlayerWithRankingsSchema> = {
          player_id: player.player_id,
          name: player.name,
          position: player.position,
          team: player.team,
          bye_week: player.team
            ? teamData[player.team]?.bye_week || null
            : null,
          rankingsByScoringType,
        };

        finalPlayerData[finalPlayer.player_id] =
          PlayerWithRankingsSchema.parse(finalPlayer);
      });

      console.log(`Processed ${playerCount} players for ${position}`);

      // Ensure the directory exists before writing the file
      ensureDirectoryExists(AGGREGATE_DATA_DIR);

      // Update this part to use the new function
      const outputFilePath = getAggregateDataFilePath(position);
      console.log(
        `Writing aggregate data for position: ${position} to ${outputFilePath}`
      );

      fs.writeFileSync(
        outputFilePath,
        JSON.stringify(finalPlayerData, null, 2)
      );
      console.log(
        `aggregated ${position} player data saved to ${outputFilePath}\n`
      );
    }
  );
}

// Run the aggregation if this file is executed directly
if (require.main === module) {
  aggregatePlayerData();
}
