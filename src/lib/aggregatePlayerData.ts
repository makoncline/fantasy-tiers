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
import {
  FETCH_TO_ROSTER_SLOT_MAP,
  POSITIONS_TO_SCORING_TYPES,
  RANKINGS_DIR,
} from "./fetchRankingData";

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
      // Load and parse rankings for each scoring type and transform to an object keyed by player name
      const rankingsData: Record<
        ScoringType,
        Record<string, z.infer<typeof RankTierSchema>>
      > = scoringTypes.reduce((acc, scoringType) => {
        const rosterSlotPosition = FETCH_TO_ROSTER_SLOT_MAP[position];
        const filePath = path.resolve(
          RANKINGS_DIR,
          `${rosterSlotPosition}-${scoringType}-rankings.json`
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

      // Combine all scoring types into a single set of player names
      const rankedPlayerNames = new Set<string>();
      Object.values(rankingsData).forEach((rankingsByScoringType) => {
        Object.keys(rankingsByScoringType).forEach((name) =>
          rankedPlayerNames.add(name)
        );
      });

      console.log(`Processing ${position}`);

      const finalPlayerData: Record<
        string,
        z.infer<typeof PlayerWithRankingsSchema>
      > = {};

      Array.from(rankedPlayerNames).forEach((playerName) => {
        const player = Object.values(playerData).find(
          (p) => normalizePlayerName(p.name) === playerName
        );

        if (!player) {
          console.log(`Player not found in Sleeper data: ${playerName}`);
          return;
        }

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

      // Ensure the directory exists before writing the file
      ensureDirectoryExists(AGGREGATE_DATA_DIR);

      const rosterSlotPosition = FETCH_TO_ROSTER_SLOT_MAP[position];
      // Update this part to use the new function
      const outputFilePath = getAggregateDataFilePath(rosterSlotPosition);

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
