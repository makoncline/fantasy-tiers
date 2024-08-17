import { DraftedPlayer } from "./draft";
import { DraftDetails } from "./draftDetails";

// Function to calculate number of players left in each position for each tier
export function calculatePositionTierCounts(availablePlayers: any) {
  const positionTierCounts: Record<string, Record<string, number>> = {};

  Object.values(availablePlayers).forEach((player: any) => {
    const { tier, position } = player;

    if (!positionTierCounts[position]) {
      positionTierCounts[position] = {};
    }

    if (!positionTierCounts[position][tier]) {
      positionTierCounts[position][tier] = 0;
    }

    positionTierCounts[position][tier]++;
  });

  return positionTierCounts;
}

// Function to get top players remaining for each position with tier data
export function getTopPlayersByPosition(availablePlayers: any, limit = 3) {
  const topPlayersByPosition: Record<string, any[]> = {};

  // Group players by position
  Object.values(availablePlayers).forEach((player: any) => {
    const { position, tier, name } = player;

    if (!topPlayersByPosition[position]) {
      topPlayersByPosition[position] = [];
    }

    topPlayersByPosition[position].push({ name, tier });
  });

  // Sort players within each position by tier and limit to the top X players
  Object.keys(topPlayersByPosition).forEach((position) => {
    topPlayersByPosition[position] = topPlayersByPosition[position]
      .sort((a, b) => a.tier.localeCompare(b.tier)) // Assuming tiers are sorted alphabetically
      .slice(0, limit); // Get the top players based on the limit
  });

  return topPlayersByPosition;
}

// Function to get the top available players, with a configurable limit
export function getLimitedAvailablePlayers(
  availablePlayers: Record<string, { tier: string; position: string }>, // Adjusted typing
  limit: number | "all"
) {
  const sortedPlayers = Object.entries(availablePlayers)
    .sort(([, playerA], [, playerB]) => {
      if (!playerA.tier || !playerB.tier) return 0; // Handle missing or undefined tiers
      return playerA.tier.localeCompare(playerB.tier);
    }) // Sort by tier
    .slice(0, limit === "all" ? undefined : limit) // Limit to top X or return all
    .reduce((result, [name, player]) => {
      result[name] = player;
      return result;
    }, {} as Record<string, { tier: string; position: string }>); // Ensure correct typing

  return sortedPlayers;
}

export function getDraftedTeams(
  draftId: string,
  draftedPlayers: DraftedPlayer[],
  draftDetails: DraftDetails
) {
  const { slot_to_roster_id } = draftDetails;

  const teams: Record<
    string,
    { pick_no: number; round: number; position: string; player_name: string }[]
  > = {};

  draftedPlayers.forEach((player) => {
    const rosterId = slot_to_roster_id[player.draft_slot];
    if (!teams[rosterId]) {
      teams[rosterId] = [];
    }

    teams[rosterId].push({
      pick_no: player.pick_no,
      round: player.round,
      position: player.metadata.position, // Accessing position from metadata
      player_name: `${player.metadata.first_name} ${player.metadata.last_name}`,
    });
  });

  return teams;
}
