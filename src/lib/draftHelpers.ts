import { DraftedPlayer, Position } from "./draft";
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

  const teams: Record<string, DraftedPlayer[]> = {};

  draftedPlayers.forEach((player) => {
    const rosterId = slot_to_roster_id[player.draft_slot];
    if (!teams[rosterId]) {
      teams[rosterId] = [];
    }

    teams[rosterId].push({
      draft_id: player.draft_id,
      draft_slot: player.draft_slot,
      round: player.round,
      pick_no: player.pick_no,
      player_id: player.player_id,
      normalized_name: player.normalized_name,
      metadata: {
        first_name: player.metadata.first_name,
        last_name: player.metadata.last_name,
        position: player.metadata.position,
      },
    });
  });

  return teams;
}

export function calculateRemainingPositionNeeds(
  draftedTeams: Record<string, DraftedPlayer[]>,
  draftDetails: DraftDetails
) {
  // Define the main position requirements
  const rosterRequirements: Record<Position, number> = {
    QB: draftDetails.settings.slots_qb,
    RB: draftDetails.settings.slots_rb,
    WR: draftDetails.settings.slots_wr,
    TE: draftDetails.settings.slots_te,
    K: draftDetails.settings.slots_k,
    DEF: draftDetails.settings.slots_def,
  };

  // Handle FLEX separately
  const flexSlots = draftDetails.settings.slots_flex;

  const remainingPositionNeeds: Record<string, Record<string, number>> = {};
  const totalRemainingNeeds: Record<string, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    FLEX: 0,
    K: 0,
    DEF: 0,
  };

  // Loop through each team
  for (const team in draftedTeams) {
    const teamNeeds = { ...rosterRequirements, FLEX: flexSlots }; // Add FLEX to teamNeeds dynamically
    remainingPositionNeeds[team] = { ...teamNeeds };

    // Track how many players of each position have been drafted
    draftedTeams[team].forEach((player) => {
      const position = player.metadata.position;
      if (position in teamNeeds && teamNeeds[position] > 0) {
        teamNeeds[position] -= 1;
      } else if (["RB", "WR", "TE"].includes(position) && teamNeeds.FLEX > 0) {
        // Deduct from FLEX if position is RB, WR, or TE
        teamNeeds.FLEX -= 1;
      }
    });

    // Update the remaining needs for the team
    for (const position in teamNeeds) {
      const pos = position as Position | "FLEX"; // Type assertion

      remainingPositionNeeds[team][pos] = Math.max(0, teamNeeds[pos]);
      totalRemainingNeeds[pos] += remainingPositionNeeds[team][pos];
    }
  }

  return { remainingPositionNeeds, totalRemainingNeeds };
}
