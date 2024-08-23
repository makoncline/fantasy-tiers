import { z } from "zod";
import {
  DraftedPlayer,
  PlayerWithRankingsSchema,
  RankedPlayer,
  RankedPlayerSchema,
  ScoringType,
} from "./schemas";

// Utility function to process data regardless of where it is loaded
export function getPlayersByScoringType(
  scoringType: ScoringType,
  aggregatePlayerData: Record<string, z.infer<typeof PlayerWithRankingsSchema>>
): Record<string, DraftedPlayer> {
  const draftedPlayers: Record<
    string,
    z.infer<typeof PlayerWithRankingsSchema> & {
      rank: number | null;
      tier: number | null;
    }
  > = {};

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
