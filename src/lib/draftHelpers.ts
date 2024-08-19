import { DraftedPlayer, Position, RosterSlot } from "./draftPicks";
import { DraftDetails } from "./draftDetails";

const RECCOMENDATION_LIMIT = 5;
export const KEY_ROSTER_SLOTS = ["RB", "WR", "TE", "QB", "FLEX"] as const;
export const BACKUP_LIMITS = {
  RB: Infinity,
  WR: Infinity,
  QB: 2,
  TE: 2,
  K: 1,
  DEF: 1,
} as const;

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
  const defaultPositionCounts = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    FLEX: 0,
    K: 0,
    DEF: 0,
  };

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
      remainingPositionRequirements: Record<string, number>;
      rosterPositionCounts: Record<string, number>;
    }
  > = {};

  // Pre-fill every team with empty players, default needs, and default counts
  Object.values(draftDetails.slot_to_roster_id).forEach((rosterId) => {
    currentRosters[rosterId] = {
      players: [],
      remainingPositionRequirements: { ...rosterRequirements },
      rosterPositionCounts: { ...defaultPositionCounts },
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
    { tier: number; position: string; rank: number; name: string }
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
  const teamNeeds = { ...rosterRequirements };
  const defaultPositionCounts: Record<string, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    FLEX: 0,
    K: 0,
    DEF: 0,
  };

  const positionCounts = { ...defaultPositionCounts };

  teamDraftedPlayers.forEach((player) => {
    const position = player.position;

    positionCounts[position]++;

    if (position in teamNeeds && teamNeeds[position] > 0) {
      teamNeeds[position] -= 1;
    } else if (["RB", "WR", "TE"].includes(position) && teamNeeds.FLEX > 0) {
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
      remainingPositionRequirements: Record<string, number>;
    }
  >
) {
  const totalRemainingNeeds: Record<string, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    FLEX: 0,
    K: 0,
    DEF: 0,
  };

  Object.values(currentRosters).forEach(({ remainingPositionRequirements }) => {
    Object.entries(remainingPositionRequirements).forEach(
      ([position, remaining]) => {
        if (position in totalRemainingNeeds) {
          totalRemainingNeeds[position] += remaining;
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
      roster.RB >= BACKUP_LIMITS.RB &&
      roster.WR >= BACKUP_LIMITS.WR &&
      roster.TE >= BACKUP_LIMITS.TE
    );
  }
  return roster[slot] >= BACKUP_LIMITS[slot];
}

function getKeyPositionRecommendations(
  availablePlayers: Record<
    string,
    { rank: number; tier: number; position: Position; name: string }
  >,
  roster: Record<Position, number>,
  rosterRequirements: Record<RosterSlot, number>
) {
  // Filter out positions that have already filled the primary starting slots
  const positionsToRecommend = KEY_ROSTER_SLOTS.filter((slot) => {
    // For FLEX, it’s filled when all RB, WR, and TE slots (including FLEX) are filled
    if (slot === "FLEX") {
      return (
        roster.RB < BACKUP_LIMITS.RB ||
        roster.WR < BACKUP_LIMITS.WR ||
        roster.TE < BACKUP_LIMITS.TE
      );
    }
    // For all other slots, check if the starting slot is filled
    return roster[slot as Position] < rosterRequirements[slot as Position];
  });

  // Get top players for key positions that are still unfilled
  const keyPositionPlayers = Object.values(availablePlayers).filter((player) =>
    positionsToRecommend.includes(player.position as any)
  );

  // Sort by tier and rank, since tier 1 is better than tier 2, and within the same tier, lower rank is better
  return keyPositionPlayers.sort((a, b) => a.tier - b.tier || a.rank - b.rank);
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
    .filter((player) => !isSlotFilled(player.position, roster))
    .sort((a, b) => a.tier - b.tier || a.rank - b.rank);
}

// Function to get best available players overall
function getBestAvailablePlayer(
  availablePlayers: Record<
    string,
    { name: string; rank: number; tier: number; position: Position }
  >,
  roster: Record<Position, number>
) {
  return Object.values(availablePlayers).sort(
    (a, b) => a.tier - b.tier || a.rank - b.rank
  );
}

function getFillRestOfRosterRecommendations(
  availablePlayers: Record<
    string,
    { rank: number; tier: number; position: Position; name: string }
  >,
  roster: Record<Position, number>
) {
  // Get all positions that are not in the key positions and are not fully filled
  const nonKeyPositions = (Object.keys(BACKUP_LIMITS) as Position[]).filter(
    (position) =>
      !KEY_ROSTER_SLOTS.includes(position as any) &&
      roster[position] < BACKUP_LIMITS[position] // Only include positions that haven't reached their limit
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
    { rank: number; tier: number; position: Position; name: string }
  >,
  roster: Record<RosterSlot, number>,
  rosterRequirements: Record<RosterSlot, number>
) {
  const recommendations = {
    keyPositions: getKeyPositionRecommendations(
      availablePlayers,
      roster,
      rosterRequirements
    ),
    backups: getBackupRecommendations(availablePlayers, roster),
    nonKeyPositions: getFillRestOfRosterRecommendations(
      availablePlayers,
      roster
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
