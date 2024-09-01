import { z } from "zod";
import {
  DraftedPlayer,
  PlayerWithRankingsSchema,
  RankedPlayer,
  ScoringType,
} from "./schemas";

// Utility function to process data regardless of where it is loaded
export function getPlayersByScoringType(
  scoringType: ScoringType,
  aggregatePlayerData: Record<string, z.infer<typeof PlayerWithRankingsSchema>>
) {
  const draftedPlayers: Record<string, DraftedPlayer> = {};

  Object.entries(aggregatePlayerData).forEach(([playerId, player]) => {
    const ranking = player.rankingsByScoringType[scoringType];
    draftedPlayers[playerId] = {
      ...player,
      rank: ranking?.rank ?? null,
      tier: ranking?.tier ?? null,
    };
  });

  return draftedPlayers;
}

export const isRankedPlayer = (player: DraftedPlayer): player is RankedPlayer =>
  player.rank !== null && player.tier !== null;
