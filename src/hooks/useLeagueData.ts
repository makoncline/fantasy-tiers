import { useQueries, useQuery } from "@tanstack/react-query";
import { getPlayersByScoringTypeClient } from "@/lib/getPlayersClient";
import {
  DraftedPlayer,
  ScoringType,
  RosterSlotEnum,
  Position,
  RosterSlot,
} from "@/lib/schemas";
import { z } from "zod";

const RosterSchema = z.object({
  roster_id: z.number(),
  owner_id: z.string(),
  players: z.array(z.string()),
  starters: z.array(z.string()),
});

type Roster = z.infer<typeof RosterSchema>;

const LeagueDetailsSchema = z.object({
  scoring_settings: z.object({
    rec: z.number(),
  }),
  roster_positions: z.array(RosterSlotEnum),
});

type LeagueDetails = z.infer<typeof LeagueDetailsSchema>;

async function fetchRosters(leagueId: string) {
  const response = await fetch(
    `https://api.sleeper.app/v1/league/${leagueId}/rosters`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch rosters");
  }
  const data = await response.json();
  return z.array(RosterSchema).parse(data);
}

async function fetchLeagueDetails(leagueId: string) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch league details");
  }
  const data = await response.json();
  return LeagueDetailsSchema.parse(data);
}

async function fetchLeagueData(leagueId: string) {
  if (!leagueId) throw new Error("League ID is required");

  const [rosters, leagueDetails] = await Promise.all([
    fetchRosters(leagueId),
    fetchLeagueDetails(leagueId),
  ]);

  return { rosters, leagueDetails };
}

function determineScoringType(
  scoringSettings: LeagueDetails["scoring_settings"]
): ScoringType {
  const recPoints = scoringSettings.rec || 0;
  if (recPoints === 0) return "std";
  if (recPoints === 0.5) return "half";
  if (recPoints === 1) return "ppr";
  console.warn(
    `Non-standard scoring detected. Defaulting to PPR. Actual reception points: ${recPoints}`
  );
  return "std";
}

// Remove the EmptyRosterSlot type and const

// Update the RosteredPlayer type
export type RosteredPlayer = DraftedPlayer & {
  slot: string;
  recommendedSlot: string;
  flexTier?: number;
  flexRank?: number;
  rosterOrder?: number;
  isEmpty?: boolean;
};

const determineCurrentRoster = (
  roster: Roster,
  players: DraftedPlayer[],
  rosterPositions: RosterSlot[],
  flexPlayers: DraftedPlayer[]
): RosteredPlayer[] => {
  const rosterPlayers: RosteredPlayer[] = [];
  const playerMap = players.reduce((acc, player) => {
    acc[player.player_id] = player;
    return acc;
  }, {} as Record<string, DraftedPlayer>);

  const flexPlayerMap = new Map(
    flexPlayers.map((p) => [
      p.player_id,
      { flexTier: p.tier, flexRank: p.rank },
    ])
  );

  const positionCounts: Record<string, number> = {};

  // Map over rosterPositions to set the current roster order
  rosterPositions.forEach((slot, index) => {
    if (slot === "BN") return; // Skip bench slots for now

    const starterId = roster.starters[index];
    if (starterId && starterId !== "0") {
      const player = playerMap[starterId];
      if (player) {
        positionCounts[slot] = (positionCounts[slot] || 0) + 1;
        const slotName = getSlotLabel(slot, positionCounts[slot]);
        const flexInfo = flexPlayerMap.get(player.player_id);
        rosterPlayers.push({
          ...player,
          slot: slotName,
          recommendedSlot: "",
          flexTier: flexInfo?.flexTier,
          flexRank: flexInfo?.flexRank,
          rosterOrder: index,
        });
      }
    } else {
      // Add empty slot for unfilled positions
      rosterPlayers.push({
        player_id: `empty-${slot}-${index}`,
        name: `Empty ${slot} Slot`,
        position: "-" as Position,
        team: "-",
        bye_week: null,
        rank: null,
        tier: null,
        slot: slot,
        recommendedSlot: "-",
        rosterOrder: index,
        isEmpty: true,
      });
    }
  });

  // Add bench players
  const benchIndex = rosterPositions.indexOf("BN");
  roster.players.forEach((playerId, index) => {
    if (!roster.starters.includes(playerId)) {
      const player = playerMap[playerId];
      if (player) {
        const flexInfo = flexPlayerMap.get(player.player_id);
        rosterPlayers.push({
          ...player,
          slot: "BN",
          recommendedSlot: "BN",
          flexTier: flexInfo?.flexTier,
          flexRank: flexInfo?.flexRank,
          rosterOrder: benchIndex + index,
        });
      }
    }
  });

  // Sort the roster based on rosterOrder
  rosterPlayers.sort((a, b) => (a.rosterOrder || 0) - (b.rosterOrder || 0));

  return rosterPlayers;
};

const determineRecommendedRoster = (
  players: DraftedPlayer[],
  rosterPositions: RosterSlot[],
  flexPlayers: DraftedPlayer[]
): RosteredPlayer[] => {
  console.log("Starting determineRecommendedRoster");
  console.log("Players:", players);
  console.log("Roster Positions:", rosterPositions);
  console.log("Flex Players:", flexPlayers);

  const rosterPlayers: RosteredPlayer[] = [];
  const availablePlayers = [...players];

  const positionCounts: Record<string, number> = {};
  const usedPlayers: Set<string> = new Set();

  const flexPlayerMap = new Map(
    flexPlayers.map((p) => [
      p.player_id,
      { flexTier: p.tier, flexRank: p.rank },
    ])
  );

  // Fill non-bench positions first
  rosterPositions.forEach((slot, index) => {
    console.log("Processing slot:", slot);
    if (slot === "BN") return;

    let eligiblePlayers: DraftedPlayer[];
    if (slot === "FLEX") {
      eligiblePlayers = players
        .filter(
          (p) => !usedPlayers.has(p.player_id) && flexPlayerMap.has(p.player_id)
        )
        .sort((a, b) => {
          const aFlexRank =
            flexPlayerMap.get(a.player_id)?.flexRank || Infinity;
          const bFlexRank =
            flexPlayerMap.get(b.player_id)?.flexRank || Infinity;
          return aFlexRank - bFlexRank;
        });
    } else {
      eligiblePlayers = availablePlayers
        .filter((p) => p.position === slot && !usedPlayers.has(p.player_id))
        .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
    }
    console.log("Eligible players for slot:", slot, eligiblePlayers);
    const bestPlayer = eligiblePlayers[0]; // Get the best ranked eligible player
    if (bestPlayer) {
      positionCounts[slot] = (positionCounts[slot] || 0) + 1;
      const recommendedSlot = getSlotLabel(slot, positionCounts[slot]);
      const flexInfo = flexPlayerMap.get(bestPlayer.player_id);
      rosterPlayers.push({
        ...bestPlayer,
        slot: recommendedSlot,
        recommendedSlot,
        flexTier: flexInfo?.flexTier,
        flexRank: flexInfo?.flexRank,
        rosterOrder: index,
      });
      usedPlayers.add(bestPlayer.player_id);
      console.log(
        "Added player to roster:",
        bestPlayer.name,
        "in slot:",
        recommendedSlot
      );
    } else {
      console.log("No eligible player found for slot:", slot);
    }
  });

  // Fill bench positions with remaining players
  availablePlayers
    .filter((p) => !usedPlayers.has(p.player_id))
    .forEach((player, index) => {
      const flexInfo = flexPlayerMap.get(player.player_id);
      rosterPlayers.push({
        ...player,
        slot: "BN",
        recommendedSlot: "BN",
        flexTier: flexInfo?.flexTier,
        flexRank: flexInfo?.flexRank,
        rosterOrder: rosterPositions.length + index,
      });
      console.log("Added player to bench:", player.name);
    });

  console.log("Final recommended roster:", rosterPlayers);
  return rosterPlayers;
};

// Helper function to get the correct slot label
const getSlotLabel = (slot: string, count: number): string => {
  if (slot === "FLEX" || slot === "BN") {
    return slot;
  }
  return count > 1 ? `${slot} ${count}` : slot;
};

// Update other functions to work with this simplified RosteredPlayer type
const findUpgradeForPlayer = (
  rosterPlayer: RosteredPlayer,
  availablePlayers: DraftedPlayer[]
) => {
  const betterPlayers = availablePlayers.filter(
    (availablePlayer) =>
      availablePlayer.position === rosterPlayer.position &&
      (availablePlayer.rank || Infinity) < (rosterPlayer.rank || Infinity)
  );

  return betterPlayers.length > 0
    ? {
        currentPlayer: rosterPlayer,
        betterPlayers: betterPlayers.sort(
          (a, b) => (a.rank || Infinity) - (b.rank || Infinity)
        ),
      }
    : null;
};

export type UpgradeOption = {
  currentPlayer: RosteredPlayer;
  betterPlayers: DraftedPlayer[];
};

const findUpgradeOptions = (
  currentRoster: RosteredPlayer[],
  availablePlayers: DraftedPlayer[]
): Record<Position, UpgradeOption[]> => {
  return currentRoster.reduce((acc, player) => {
    const upgrade = findUpgradeForPlayer(player, availablePlayers);
    if (upgrade) {
      if (!acc[player.position]) {
        acc[player.position] = [];
      }
      acc[player.position].push(upgrade);
    }
    return acc;
  }, {} as Record<Position, UpgradeOption[]>);
};

export function useLeagueData(leagueId: string, userId: string) {
  const {
    data: leagueData,
    isLoading: isLoadingLeagueData,
    error: leagueError,
    refetch: refetchData,
  } = useQuery<{ rosters: Roster[]; leagueDetails: LeagueDetails }, Error>({
    queryKey: ["leagueData", leagueId],
    queryFn: () => fetchLeagueData(leagueId),
    enabled: !!leagueId,
    staleTime: 0,
  });

  const leagueScoringType = leagueData
    ? determineScoringType(leagueData.leagueDetails.scoring_settings)
    : null;

  const playerQueries = useQueries({
    queries: RosterSlotEnum.options
      .filter((position) => position !== "BN" && position !== "FLEX")
      .map((position) => ({
        queryKey: ["playerData", leagueScoringType, position],
        queryFn: () =>
          getPlayersByScoringTypeClient(
            leagueScoringType as ScoringType,
            position
          ),
        enabled: !!leagueScoringType,
      })),
  });

  const flexQuery = useQuery({
    queryKey: ["playerData", leagueScoringType, "FLEX"],
    queryFn: () =>
      getPlayersByScoringTypeClient(leagueScoringType as ScoringType, "FLEX"),
    enabled: !!leagueScoringType,
  });

  const isLoadingPlayerData =
    playerQueries.some((query) => query.isLoading) || flexQuery.isLoading;
  const playerDataError =
    (playerQueries.find((query) => query.error)?.error as Error | null) ||
    flexQuery.error;

  const allPlayers = [
    ...playerQueries.flatMap((query) =>
      query.data ? Object.values(query.data) : []
    ),
    ...(flexQuery.data ? Object.values(flexQuery.data) : []),
  ];

  const rosters = leagueData?.rosters || [];
  const userRoster =
    rosters.find((roster) => roster.owner_id === userId) || null;
  const rosteredPlayerIds = rosters.flatMap((roster) => roster.players);

  const availablePlayers = allPlayers.filter(
    (player) => !rosteredPlayerIds.includes(player.player_id)
  );

  const availablePlayersByPosition = availablePlayers.reduce((acc, player) => {
    if (!acc[player.position]) {
      acc[player.position] = [];
    }
    acc[player.position].push(player);
    return acc;
  }, {} as Record<Position, DraftedPlayer[]>);

  const userPlayersWithDetails = userRoster
    ? userRoster.players
        .map((playerId) => allPlayers.find((p) => p.player_id === playerId))
        .filter((player): player is DraftedPlayer => player !== undefined)
    : [];

  const currentRoster =
    userRoster &&
    userPlayersWithDetails.length > 0 &&
    leagueData?.leagueDetails?.roster_positions &&
    flexQuery.data
      ? determineCurrentRoster(
          userRoster,
          userPlayersWithDetails,
          leagueData.leagueDetails.roster_positions,
          Object.values(flexQuery.data)
        )
      : [];

  const recommendedRoster =
    userPlayersWithDetails.length > 0 &&
    leagueData?.leagueDetails?.roster_positions &&
    flexQuery.data
      ? determineRecommendedRoster(
          userPlayersWithDetails,
          leagueData.leagueDetails.roster_positions,
          Object.values(flexQuery.data)
        )
      : [];

  const mergedRoster = currentRoster.map((player) => {
    const recommendedPlayer = recommendedRoster.find(
      (rp) => rp.player_id === player.player_id
    );
    return {
      ...player,
      recommendedSlot: recommendedPlayer
        ? recommendedPlayer.recommendedSlot
        : player.slot,
      flexTier: recommendedPlayer?.flexTier ?? player.flexTier,
      flexRank: recommendedPlayer?.flexRank ?? player.flexRank,
      rosterOrder: recommendedPlayer?.rosterOrder ?? player.rosterOrder,
    };
  });

  // Add any players that are in recommendedRoster but not in currentRoster
  recommendedRoster.forEach((recommendedPlayer) => {
    if (
      !mergedRoster.some((p) => p.player_id === recommendedPlayer.player_id)
    ) {
      mergedRoster.push({
        ...recommendedPlayer,
        slot: "BN", // Assume these players are currently on the bench
        recommendedSlot: recommendedPlayer.recommendedSlot,
      });
    }
  });

  // Sort the mergedRoster based on the original roster order
  mergedRoster.sort((a, b) => (a.rosterOrder || 0) - (b.rosterOrder || 0));

  const rankedAvailablePlayersByPosition = Object.entries(
    availablePlayersByPosition
  ).reduce((acc, [position, players]) => {
    if (position !== "BN") {
      acc[position as RosterSlot] = players.sort(
        (a, b) => (a.rank || Infinity) - (b.rank || Infinity)
      );
    }
    return acc;
  }, {} as Record<RosterSlot, DraftedPlayer[]>);

  // Handle FLEX separately
  if (flexQuery.data) {
    rankedAvailablePlayersByPosition["FLEX"] = Object.values(flexQuery.data)
      .filter((player) => !rosteredPlayerIds.includes(player.player_id))
      .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
  }

  // Create a mapping of player IDs to their FLEX rankings
  const flexPlayerMap = flexQuery.data;

  const worstRankedUserPlayersByPosition = Object.entries(
    availablePlayersByPosition
  ).reduce((acc, [position]) => {
    if (["RB", "WR", "TE", "QB", "K", "DEF"].includes(position)) {
      const positionPlayers = currentRoster.filter(
        (p) => p.position === position
      );
      if (positionPlayers.length > 0) {
        acc[position as RosterSlot] = positionPlayers.reduce((worst, player) =>
          (player.rank || Infinity) > (worst.rank || Infinity) ? player : worst
        );
      }
    }
    return acc;
  }, {} as Record<RosterSlot, RosteredPlayer>);

  const upgradeOptions: Record<Position, UpgradeOption[]> | null =
    currentRoster && availablePlayers.length > 0
      ? findUpgradeOptions(currentRoster, availablePlayers)
      : null;

  const isLoading = isLoadingLeagueData || isLoadingPlayerData;
  const error = leagueError || playerDataError;

  return {
    rosters,
    userRoster,
    rosteredPlayerIds,
    scoringType: leagueScoringType,
    leagueDetails: leagueData?.leagueDetails,
    recommendedRoster,
    currentRoster: mergedRoster,
    isLoading,
    error: error as Error | null,
    rankedAvailablePlayersByPosition,
    worstRankedUserPlayersByPosition,
    upgradeOptions,
    refetchData,
    flexPlayerMap,
  };
}

export type LeagueData = ReturnType<typeof useLeagueData>;
