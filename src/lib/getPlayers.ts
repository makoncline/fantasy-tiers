import fs from "fs";
import { z } from "zod";
import { ScoringType } from "./rankings";
import {
  AGGREGATE_PLAYER_DATA_FILE_PATH,
  PlayerSchema,
  PlayerWithRankingsSchema,
} from "./aggregatePlayerData";

export const DraftedPlayerSchema = PlayerSchema.extend({
  rank: z.number().nullable(),
  tier: z.number().nullable(),
});

// Ranked player schema with non-nullable rank and tier
export const RankedPlayerSchema = PlayerSchema.extend({
  rank: z.number(),
  tier: z.number(),
});

type DraftedPlayer = z.infer<typeof DraftedPlayerSchema>;
type RankedPlayer = z.infer<typeof RankedPlayerSchema>;

// Load the aggregated player data as an object
function loadAggregatePlayerData() {
  const data = fs.readFileSync(AGGREGATE_PLAYER_DATA_FILE_PATH, "utf-8");
  return z.record(PlayerWithRankingsSchema).parse(JSON.parse(data));
}

// Function to get players by scoring type with nullable rank/tier
export function getDraftedPlayersByScoringType(
  scoringType: ScoringType
): Record<string, DraftedPlayer> {
  const aggregatePlayerData = loadAggregatePlayerData();

  const draftedPlayers: Record<string, DraftedPlayer> = {};

  Object.entries(aggregatePlayerData).forEach(([playerId, player]) => {
    const ranking = player.rankingsByScoringType[scoringType];

    draftedPlayers[playerId] = DraftedPlayerSchema.parse({
      ...player,
      rank: ranking?.rank ?? null,
      tier: ranking?.tier ?? null,
    });
  });

  return draftedPlayers;
}

// Function to get only players with a valid rank and tier
export function getRankedPlayersByScoringType(
  scoringType: ScoringType
): RankedPlayer[] {
  const draftedPlayers = getDraftedPlayersByScoringType(scoringType);
  return Object.values(draftedPlayers).filter(
    (player): player is RankedPlayer =>
      player.rank !== null && player.tier !== null
  );
}
