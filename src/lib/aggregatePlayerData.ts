import fs from "fs";
import path from "path";
import { z } from "zod";
import { PLAYER_DATA_FILE_PATH, SleeperPlayerSchema } from "./parsePlayerData";
import { TEAM_DATA_FILE_PATH, TeamSchema } from "./parseTeamData";
import { normalizePlayerName } from "./util";
import {
  PlayerWithRankingsSchema,
  RankTierSchema,
  SCORING_TYPES,
  ScoringType,
} from "./schemas";
import { AGGREGATE_PLAYER_DATA_FILE_PATH } from "./getPlayersServer";

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

  // Load and parse rankings for each scoring type and transform to an object keyed by player name
  const rankingsData: Record<
    ScoringType,
    Record<string, z.infer<typeof RankTierSchema>>
  > = SCORING_TYPES.reduce((acc, scoringType) => {
    const filePath = path.resolve(
      `./public/data/rankings/${scoringType}-rankings.json`
    );
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

  // Combine all the parsed data into the final player data
  const finalPlayerData: Record<
    string,
    z.infer<typeof PlayerWithRankingsSchema>
  > = {};

  for (const [playerId, player] of Object.entries(playerData)) {
    // Handle the case where the team is not found in the teamData
    const teamByeWeek = player.team
      ? teamData[player.team]?.bye_week || null
      : null;

    // Build the rankings by scoring type based on the normalized player name
    const rankingsByScoringType = {
      std: rankingsData.std[player.name] || null,
      ppr: rankingsData.ppr[player.name] || null,
      half: rankingsData.half[player.name] || null,
    };

    // Assemble the final player object
    finalPlayerData[playerId] = PlayerWithRankingsSchema.parse({
      player_id: player.player_id,
      name: player.name,
      position: player.position,
      team: player.team,
      bye_week: teamByeWeek, // Ensured to be either a string or null
      rankingsByScoringType,
    });
  }

  // Save the final player data
  fs.writeFileSync(
    AGGREGATE_PLAYER_DATA_FILE_PATH,
    JSON.stringify(finalPlayerData, null, 2)
  );
  console.log(`Final player data saved to ${AGGREGATE_PLAYER_DATA_FILE_PATH}`);
}

// Run the aggregation if this file is executed directly
if (require.main === module) {
  aggregatePlayerData();
}
