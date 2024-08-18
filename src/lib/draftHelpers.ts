import { DraftedPlayer, Position } from "./draftPicks";
import { DraftDetails } from "./draftDetails";

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
  rosterRequirements: Record<Position | "FLEX", number>
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
      positionNeeds: Record<string, number>;
      positionCounts: Record<string, number>;
    }
  > = {};

  // Pre-fill every team with empty players, default needs, and default counts
  Object.values(draftDetails.slot_to_roster_id).forEach((rosterId) => {
    currentRosters[rosterId] = {
      players: [],
      positionNeeds: { ...rosterRequirements },
      positionCounts: { ...defaultPositionCounts },
    };
  });

  // Update rosters for teams that have drafted players
  Object.entries(draftedTeams).forEach(([teamId, players]) => {
    const { positionNeeds, positionCounts } =
      calculateTeamNeedsAndCountsForSingleTeam(players, rosterRequirements);

    currentRosters[teamId] = {
      players,
      positionNeeds,
      positionCounts,
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
  rosterRequirements: Record<Position | "FLEX", number>
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
      positionNeeds: Record<string, number>;
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

  Object.values(currentRosters).forEach(({ positionNeeds }) => {
    Object.entries(positionNeeds).forEach(([position, remaining]) => {
      if (position in totalRemainingNeeds) {
        totalRemainingNeeds[position] += remaining;
      }
    });
  });

  return totalRemainingNeeds;
}
