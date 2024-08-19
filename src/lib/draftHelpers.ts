import { DraftedPlayer, Position, RosterSlot } from "./draftPicks";
import { DraftDetails } from "./draftDetails";

const RECCOMENDATION_LIMIT = 5;
export const KEY_ROSTER_SLOTS = ["RB", "WR", "TE", "QB", "FLEX"] as const;
export const FLEX_POSITIONS = ["RB", "WR", "TE"] as const;
export const POSITION_LIMITS = {
  RB: Infinity,
  WR: Infinity,
  QB: 2,
  TE: 2,
  K: 1,
  DEF: 1,
} as const;
export const POSITION_RECOMMENDATION_LIMIT = 2;
const ZERO_POSITION_COUNTS: Record<Position, number> = {
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DEF: 0,
};
const ZERO_ROSTER_SLOT_COUNTS: Record<RosterSlot, number> = {
  ...ZERO_POSITION_COUNTS,
  FLEX: 0,
};

export function initializeRosters(
  draftDetails: DraftDetails,
  draftedTeams: Record<
    string,
    {
      round: number;
      pick_no: number;
      player_name: string;
      position: Position;
    }[]
  >,
  rosterRequirements: Record<RosterSlot, number>
) {
  // Initialize rosters for all teams with default values
  const currentRosters: Record<
    string,
    {
      players: {
        round: number;
        pick_no: number;
        player_name: string;
        position: string;
      }[];
      remainingPositionRequirements: Record<RosterSlot, number>;
      rosterPositionCounts: Record<Position, number>;
    }
  > = {};

  // Pre-fill every team with empty players, default needs, and default counts
  Object.values(draftDetails.slot_to_roster_id).forEach((rosterId) => {
    currentRosters[rosterId] = {
      players: [],
      remainingPositionRequirements: { ...rosterRequirements },
      rosterPositionCounts: { ...ZERO_ROSTER_SLOT_COUNTS },
    };
  });

  // Update rosters for teams that have drafted players
  Object.entries(draftedTeams).forEach(([teamId, players]) => {
    const { positionNeeds, positionCounts } =
      calculateTeamNeedsAndCountsForSingleTeam(players, rosterRequirements);

    currentRosters[teamId] = {
      players,
      remainingPositionRequirements: positionNeeds,
      rosterPositionCounts: positionCounts,
    };
  });

  return currentRosters;
}

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
    { name: string; rank: number; tier: number; position: Position }
  >,
  limit = 3
) {
  const topPlayersByPosition: Record<
    string,
    { name: string; rank: number; tier: number }[]
  > = {};

  // Group players by position
  Object.values(availablePlayers).forEach((player) => {
    const { position, tier, name, rank } = player;

    if (!topPlayersByPosition[position]) {
      topPlayersByPosition[position] = [];
    }

    topPlayersByPosition[position].push({ name, rank, tier });
  });

  // Sort players within each position by rank and limit to the top X players
  Object.keys(topPlayersByPosition).forEach((position) => {
    topPlayersByPosition[position] = topPlayersByPosition[position]
      .sort((a, b) => a.rank - b.rank) // Sort by rank
      .slice(0, limit); // Get the top players based on the limit
  });

  return topPlayersByPosition;
}

export function getLimitedAvailablePlayers(
  availablePlayers: Record<string, { rank: number; position: Position }>,
  limit: number | "all"
) {
  const sortedPlayers = Object.entries(availablePlayers)
    .sort(([, playerA], [, playerB]) => playerA.rank - playerB.rank)
    .slice(0, limit === "all" ? undefined : limit)
    .reduce((result, [name, player]) => {
      result[name] = player;
      return result;
    }, {} as Record<string, { rank: number; position: string }>);

  return sortedPlayers;
}

export function getDraftedTeams(
  draftId: string,
  draftedPlayers: DraftedPlayer[],
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

export function calculateTeamNeedsAndCountsForSingleTeam(
  teamDraftedPlayers: {
    round: number;
    pick_no: number;
    player_name: string;
    position: Position;
  }[],
  rosterRequirements: Record<RosterSlot, number>
) {
  // Copy of the roster requirements to track needs
  const teamNeeds = { ...rosterRequirements };

  // Initialize position counts without FLEX
  const positionCounts = { ...ZERO_POSITION_COUNTS };

  // Iterate over drafted players and adjust position counts and needs
  teamDraftedPlayers.forEach((player) => {
    const position = player.position;

    // Increment position count
    positionCounts[position]++;

    // Deduct from the primary position if there's a need
    if (teamNeeds[position] > 0) {
      teamNeeds[position] -= 1;
    }
    // Otherwise, deduct from FLEX if applicable
    else if (FLEX_POSITIONS.includes(position as any) && teamNeeds.FLEX > 0) {
      teamNeeds.FLEX -= 1;
    }
  });

  return {
    positionNeeds: teamNeeds,
    positionCounts,
  };
}

export function calculateTotalRemainingNeeds(
  currentRosters: Record<
    string,
    {
      remainingPositionRequirements: Record<Position, number>;
    }
  >
) {
  const totalRemainingNeeds = { ...ZERO_ROSTER_SLOT_COUNTS };

  Object.values(currentRosters).forEach(({ remainingPositionRequirements }) => {
    Object.entries(remainingPositionRequirements).forEach(
      ([position, remaining]) => {
        if (position in totalRemainingNeeds) {
          totalRemainingNeeds[position as keyof typeof totalRemainingNeeds] +=
            remaining;
        }
      }
    );
  });

  return totalRemainingNeeds;
}

// Helper function to check if a slot is filled based on roster needs
function isSlotFilled(slot: RosterSlot, roster: Record<Position, number>) {
  if (slot === "FLEX") {
    return (
      roster.RB >= POSITION_LIMITS.RB &&
      roster.WR >= POSITION_LIMITS.WR &&
      roster.TE >= POSITION_LIMITS.TE
    );
  }
  return roster[slot] >= POSITION_LIMITS[slot];
}

export function getKeyPositionRecommendations(
  availablePlayers: Record<
    string,
    { name: string; rank: number; tier: number; position: Position }
  >,
  teamNeeds: Record<RosterSlot, number>
) {
  const positionsToTarget = new Set<Position>();

  // Loop through each key roster slot to determine positions we need to fill
  KEY_ROSTER_SLOTS.forEach((slot) => {
    if (teamNeeds[slot] > 0) {
      positionsToTarget.add(slot as Position);
    }
  });

  // If FLEX is still needed, add all FLEX-eligible positions (RB, WR, TE)
  if (teamNeeds.FLEX > 0) {
    FLEX_POSITIONS.forEach((position) => positionsToTarget.add(position));
  }

  // Filter and sort available players based on the positionsToTarget set
  const keyPositionPlayers = Object.values(availablePlayers)
    .filter((player) => positionsToTarget.has(player.position))
    .sort((a, b) => a.tier - b.tier || a.rank - b.rank); // Sort by tier first, then rank

  // Return the top recommended players
  return keyPositionPlayers;
}

// Function to get recommendations for filling backup slots
function getBackupRecommendations(
  availablePlayers: Record<
    string,
    { name: string; rank: number; tier: number; position: Position }
  >,
  roster: Record<Position, number>
) {
  return Object.values(availablePlayers)
    .filter((player) => {
      // Check if the position is already filled considering FLEX
      return (
        !isSlotFilled(player.position, roster) ||
        player.position in FLEX_POSITIONS
      );
    })
    .sort((a, b) => a.tier - b.tier || a.rank - b.rank);
}

// Function to get best available players overall, considering position limits
function getBestAvailablePlayer(
  availablePlayers: Record<
    string,
    { name: string; rank: number; tier: number; position: Position }
  >,
  rosterPositionCounts: Record<Position, number>
) {
  return Object.values(availablePlayers)
    .filter((player) => {
      // Only include players if their position hasn't reached the roster limit
      const currentCount = rosterPositionCounts[player.position] || 0;
      return currentCount < POSITION_LIMITS[player.position];
    })
    .sort((a, b) => a.tier - b.tier || a.rank - b.rank);
}

function getFillRestOfRosterRecommendations(
  availablePlayers: Record<
    string,
    { name: string; rank: number; tier: number; position: Position }
  >,
  roster: Record<Position, number>
) {
  // Get all positions that are not in the key positions and are not fully filled
  const nonKeyPositions = (Object.keys(POSITION_LIMITS) as Position[]).filter(
    (position) =>
      !KEY_ROSTER_SLOTS.includes(position as any) &&
      roster[position] < POSITION_LIMITS[position] // Only include positions that haven't reached their limit
  );

  // Filter for available players in non-key positions
  const fillRosterPlayers = Object.values(availablePlayers).filter((player) =>
    nonKeyPositions.includes(player.position)
  );

  // Sort by tier and rank (since lower tiers are better)
  return fillRosterPlayers.sort((a, b) => a.tier - b.tier || a.rank - b.rank);
}

// Main function to get draft recommendations
// Ensure all recommendations include the required fields
export function getDraftRecommendations(
  availablePlayers: Record<
    string,
    { name: string; rank: number; tier: number; position: Position }
  >,
  rosterPositionCounts: Record<Position, number>, // Updated type to match rosterPositionCounts
  teamNeeds: Record<RosterSlot, number> // Updated to use the calculated team needs
) {
  const recommendations = {
    keyPositions: getKeyPositionRecommendations(
      availablePlayers,
      teamNeeds // Pass in the calculated team needs directly
    ),
    bestAvailable: getBestAvailablePlayer(
      availablePlayers,
      rosterPositionCounts
    ),
    backups: getBackupRecommendations(availablePlayers, rosterPositionCounts), // No change needed
    nonKeyPositions: getFillRestOfRosterRecommendations(
      availablePlayers,
      rosterPositionCounts // No change needed
    ),
  };

  // Limit to the top 3 recommendations per category
  (Object.keys(recommendations) as (keyof typeof recommendations)[]).forEach(
    (category) => {
      recommendations[category] = recommendations[category].slice(
        0,
        RECCOMENDATION_LIMIT
      );
    }
  );

  return recommendations;
}
