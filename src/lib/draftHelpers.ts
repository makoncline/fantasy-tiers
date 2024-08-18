import { DraftedPlayer, Position } from "./draftPicks";
import { DraftDetails } from "./draftDetails";

export function calculatePositionTierCounts(
  availablePlayers: Record<string, { tier: number; position: Position }>
) {
  const positionTierCounts: Record<string, Record<number, number>> = {};

  Object.values(availablePlayers).forEach((player) => {
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

export function getTopPlayersByPosition(
  availablePlayers: Record<
    string,
    { rank: number; position: Position; name: string }
  >,
  limit = 3
) {
  const topPlayersByPosition: Record<string, { name: string; rank: number }[]> =
    {};

  // Group players by position
  Object.values(availablePlayers).forEach((player) => {
    const { position, rank, name } = player;

    if (!topPlayersByPosition[position]) {
      topPlayersByPosition[position] = [];
    }

    topPlayersByPosition[position].push({ name, rank });
  });

  // Sort players within each position by rank and limit to the top X players
  Object.keys(topPlayersByPosition).forEach((position) => {
    topPlayersByPosition[position] = topPlayersByPosition[position]
      .sort((a, b) => a.rank - b.rank) // Sort directly by rank
      .slice(0, limit); // Get the top players based on the limit
  });

  return topPlayersByPosition;
}

export function getLimitedAvailablePlayers(
  availablePlayers: Record<string, { rank: number; position: Position }>, // Simplified typing
  limit: number | "all"
) {
  const sortedPlayers = Object.entries(availablePlayers)
    .sort(([, playerA], [, playerB]) => playerA.rank - playerB.rank) // Sort directly by rank
    .slice(0, limit === "all" ? undefined : limit) // Limit to top X or return all
    .reduce((result, [name, player]) => {
      result[name] = player;
      return result;
    }, {} as Record<string, { rank: number; position: string }>);

  return sortedPlayers;
}
export function getDraftedTeams(
  draftId: string,
  draftedPlayers: DraftedPlayer[], // Assuming you have a DraftedPlayer type defined
  draftDetails: any
) {
  const draftedTeams: Record<
    string,
    {
      round: number;
      pick_no: number;
      player_name: string;
      position: Position;
    }[]
  > = {};

  draftedPlayers.forEach((player) => {
    const teamId = draftDetails.slot_to_roster_id[player.draft_slot];
    if (!draftedTeams[teamId]) {
      draftedTeams[teamId] = [];
    }

    draftedTeams[teamId].push({
      round: player.round,
      pick_no: player.pick_no,
      player_name: player.normalized_name!,
      position: player.metadata.position,
    });
  });

  return draftedTeams;
}

export function calculateRemainingPositionNeeds(
  draftedTeams: Record<
    string,
    {
      round: number;
      pick_no: number;
      player_name: string;
      position: Position;
    }[]
  >,
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

  // Initialize all teams, even if they haven't picked yet
  for (const [slot, rosterId] of Object.entries(
    draftDetails.slot_to_roster_id
  )) {
    const teamNeeds = { ...rosterRequirements, FLEX: flexSlots }; // Add FLEX to teamNeeds dynamically
    remainingPositionNeeds[rosterId] = { ...teamNeeds };
  }

  // Loop through each team and adjust based on drafted players
  for (const team in draftedTeams) {
    const teamNeeds = remainingPositionNeeds[team];

    // Track how many players of each position have been drafted
    draftedTeams[team].forEach((player) => {
      const position = player.position;
      if (position in teamNeeds && teamNeeds[position] > 0) {
        teamNeeds[position] -= 1;
      } else if (["RB", "WR", "TE"].includes(position) && teamNeeds.FLEX > 0) {
        // Deduct from FLEX if position is RB, WR, or TE
        teamNeeds.FLEX -= 1;
      }
    });
  }

  // Calculate totalRemainingNeeds by summing the remaining needs for each position across all teams
  for (const teamNeeds of Object.values(remainingPositionNeeds)) {
    for (const position in teamNeeds) {
      const pos = position as Position | "FLEX"; // Type assertion
      totalRemainingNeeds[pos] += teamNeeds[pos];
    }
  }

  return { remainingPositionNeeds, totalRemainingNeeds };
}
