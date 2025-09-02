import type {
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
    // Use only the requested scoring type; no std fallback needed since
    // QB/K/DEF are mirrored at build time and others have true variants.
    const rankings =
      player.rankingsByScoringType[scoringType] ||
      ({ rank: null, tier: null } as const);

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
