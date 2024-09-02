import {
  DraftedPlayer,
  PlayerWithRankings,
  RankedPlayer,
  ScoringType,
} from "./schemas";

// Utility function to process data regardless of where it is loaded
export function getPlayersByScoringType(
  scoringType: ScoringType,
  players: Record<string, PlayerWithRankings>
): Record<string, DraftedPlayer> {
  return Object.entries(players).reduce((acc, [playerId, player]) => {
    const rankings = player.rankingsByScoringType[scoringType] ||
      player.rankingsByScoringType["std"] || { rank: null, tier: null };

    acc[playerId] = {
      ...player,
      rank: rankings.rank,
      tier: rankings.tier,
    };
    return acc;
  }, {} as Record<string, DraftedPlayer>);
}

export const isRankedPlayer = (player: DraftedPlayer): player is RankedPlayer =>
  player.rank !== null && player.tier !== null;
