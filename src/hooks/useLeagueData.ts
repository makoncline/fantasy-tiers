import { useQuery } from "@tanstack/react-query";
import type {
  DraftedPlayer,
  ScoringType,
  Position,
  RosterSlot,
} from "@/lib/schemas";
import { RosterSlotEnum } from "@/lib/schemas";
import { ROSTER_SLOTS } from "@/lib/schemas";
import { z } from "zod";
import { CombinedShard } from "@/lib/schemas-aggregates";
import { buildPlayersMapFromCombined } from "@/lib/playersFromCombined";

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
        const rosterPlayer: RosteredPlayer = {
          ...player,
          slot: slotName,
          recommendedSlot: "",
          rosterOrder: index,
        };
        if (flexInfo?.flexTier !== undefined && flexInfo?.flexTier !== null) {
          rosterPlayer.flexTier = flexInfo.flexTier;
        }
        if (flexInfo?.flexRank !== undefined && flexInfo?.flexRank !== null) {
          rosterPlayer.flexRank = flexInfo.flexRank;
        }
        rosterPlayers.push(rosterPlayer);
      }
    } else {
      // Add empty slot for unfilled positions
      positionCounts[slot] = (positionCounts[slot] || 0) + 1;
      const slotName = getSlotLabel(slot, positionCounts[slot]);
      rosterPlayers.push({
        player_id: `empty-${slot}-${index}`,
        name: `Empty ${slot} Slot`,
        position: "-" as Position,
        team: "-",
        bye_week: null,
        rank: null,
        tier: null,
        slot: slotName,
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
        const rosterPlayer: RosteredPlayer = {
          ...player,
          slot: "BN",
          recommendedSlot: "BN",
          rosterOrder: benchIndex + index,
        };
        if (flexInfo?.flexTier !== undefined && flexInfo?.flexTier !== null) {
          rosterPlayer.flexTier = flexInfo.flexTier;
        }
        if (flexInfo?.flexRank !== undefined && flexInfo?.flexRank !== null) {
          rosterPlayer.flexRank = flexInfo.flexRank;
        }
        rosterPlayers.push(rosterPlayer);
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
    const bestPlayer = eligiblePlayers[0]; // Get the best ranked eligible player
    if (bestPlayer) {
      positionCounts[slot] = (positionCounts[slot] || 0) + 1;
      const recommendedSlot = getSlotLabel(slot, positionCounts[slot]);
      const flexInfo = flexPlayerMap.get(bestPlayer.player_id);
      const rosterPlayer: RosteredPlayer = {
        ...bestPlayer,
        slot: recommendedSlot,
        recommendedSlot,
        rosterOrder: index,
      };
      if (flexInfo?.flexTier !== undefined && flexInfo?.flexTier !== null) {
        rosterPlayer.flexTier = flexInfo.flexTier;
      }
      if (flexInfo?.flexRank !== undefined && flexInfo?.flexRank !== null) {
        rosterPlayer.flexRank = flexInfo.flexRank;
      }
      rosterPlayers.push(rosterPlayer);
      usedPlayers.add(bestPlayer.player_id);
    } else {
      console.log("No eligible player found for slot:", slot);
    }
  });

  // Fill bench positions with remaining players
  availablePlayers
    .filter((p) => !usedPlayers.has(p.player_id))
    .forEach((player, index) => {
      const flexInfo = flexPlayerMap.get(player.player_id);
      const rosterPlayer: RosteredPlayer = {
        ...player,
        slot: "BN",
        recommendedSlot: "BN",
        rosterOrder: rosterPositions.length + index,
      };
      if (flexInfo?.flexTier !== undefined && flexInfo?.flexTier !== null) {
        rosterPlayer.flexTier = flexInfo.flexTier;
      }
      if (flexInfo?.flexRank !== undefined && flexInfo?.flexRank !== null) {
        rosterPlayer.flexRank = flexInfo.flexRank;
      }
      rosterPlayers.push(rosterPlayer);
    });

  return rosterPlayers;
};

// Helper function to get the correct slot label
const getSlotLabel = (slot: string, count: number): string => {
  if (slot === "BN") return "BN";
  // Always append index for non-bench slots, including FLEX
  return `${slot}${count}`;
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

  // Load ALL shard (merged) and map to DraftedPlayer using Borischen tiers
  const playersQuery = useQuery<Record<string, DraftedPlayer>, Error>({
    queryKey: ["players", leagueScoringType],
    queryFn: async () => {
      if (!leagueScoringType) return {} as Record<string, DraftedPlayer>;
      const res = await fetch(
        `/api/players?scoring=${encodeURIComponent(leagueScoringType)}`
      );
      if (!res.ok) throw new Error("failed to load players map");
      const json = await res.json();
      const combined = CombinedShard.parse(json);
      return buildPlayersMapFromCombined(combined, leagueScoringType) as Record<
        string,
        DraftedPlayer
      >;
    },
    enabled: !!leagueScoringType,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const isLoadingPlayerData = playersQuery.isLoading;
  const playerDataError = playersQuery.error as Error | null;

  const allPlayers = playersQuery.data ? Object.values(playersQuery.data) : [];
  const positionPlayers = allPlayers;

  // Load FLEX shard separately to compute flexRank/flexTier from Borischen FLEX data
  const flexQuery = useQuery<Record<string, DraftedPlayer>, Error>({
    queryKey: ["players-flex", leagueScoringType],
    queryFn: async () => {
      if (!leagueScoringType) return {} as Record<string, DraftedPlayer>;
      const res = await fetch(`/api/aggregates/shard?pos=FLEX`);
      if (!res.ok) throw new Error("failed to load FLEX shard");
      const json = await res.json();
      const combined = CombinedShard.parse(json);
      return buildPlayersMapFromCombined(combined, leagueScoringType) as Record<
        string,
        DraftedPlayer
      >;
    },
    enabled: !!leagueScoringType,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const flexPlayers = flexQuery.data
    ? Object.values(flexQuery.data)
        .filter((p) => ["RB", "WR", "TE"].includes(p.position))
        .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    : [];

  const rosters = leagueData?.rosters || [];
  const userRoster =
    rosters.find((roster) => roster.owner_id === userId) || null;
  const rosteredPlayerIds = rosters.flatMap((roster) => roster.players);

  const availablePositionPlayers = positionPlayers.filter(
    (player) => !rosteredPlayerIds.includes(player.player_id)
  );
  const availableFlexPlayers = flexPlayers.filter(
    (player) => !rosteredPlayerIds.includes(player.player_id)
  );

  const availablePlayersByPosition = ROSTER_SLOTS.filter(
    (slot) => slot !== "BN"
  ).reduce((acc, slot) => {
    if (slot === "FLEX") {
      acc[slot] = availableFlexPlayers;
    } else {
      acc[slot] = availablePositionPlayers.filter(
        (player) => player.position === slot
      );
    }
    return acc;
  }, {} as Record<Exclude<RosterSlot, "BN">, DraftedPlayer[]>);

  const userPlayersWithDetails = userRoster
    ? userRoster.players
        .map((playerId) =>
          positionPlayers.find((p) => p.player_id === playerId)
        )
        .filter((player): player is DraftedPlayer => player !== undefined)
    : [];

  const currentRoster =
    userRoster &&
    userPlayersWithDetails.length > 0 &&
    leagueData?.leagueDetails?.roster_positions &&
    playersQuery.data
      ? determineCurrentRoster(
          userRoster,
          userPlayersWithDetails,
          leagueData.leagueDetails.roster_positions,
          flexPlayers
        )
      : [];

  const recommendedRoster =
    userPlayersWithDetails.length > 0 &&
    leagueData?.leagueDetails?.roster_positions &&
    playersQuery.data
      ? determineRecommendedRoster(
          userPlayersWithDetails,
          leagueData.leagueDetails.roster_positions,
          flexPlayers
        )
      : [];

  const mergedRoster = currentRoster.map((player) => {
    const recommendedPlayer = recommendedRoster.find(
      (rp) => rp.player_id === player.player_id
    );
    const result: RosteredPlayer = {
      ...player,
      recommendedSlot: recommendedPlayer
        ? recommendedPlayer.recommendedSlot
        : player.slot,
    };
    const rosterOrder = recommendedPlayer?.rosterOrder ?? player.rosterOrder;
    if (rosterOrder !== undefined) {
      result.rosterOrder = rosterOrder;
    }
    const flexTier = recommendedPlayer?.flexTier ?? player.flexTier;
    if (flexTier !== undefined) {
      result.flexTier = flexTier;
    }
    const flexRank = recommendedPlayer?.flexRank ?? player.flexRank;
    if (flexRank !== undefined) {
      result.flexRank = flexRank;
    }
    return result;
  });

  // Add any players that are in recommendedRoster but not in currentRoster
  recommendedRoster.forEach((recommendedPlayer) => {
    if (
      !mergedRoster.some((p) => p.player_id === recommendedPlayer.player_id)
    ) {
      const rosterPlayer: RosteredPlayer = {
        ...recommendedPlayer,
        slot: "BN", // Assume these players are currently on the bench
        recommendedSlot: recommendedPlayer.recommendedSlot,
        rosterOrder: mergedRoster.length, // Assign a roster order
        isEmpty: false, // It's not an empty slot
      };
      if (
        recommendedPlayer.flexTier !== undefined &&
        recommendedPlayer.flexTier !== null
      ) {
        rosterPlayer.flexTier = recommendedPlayer.flexTier;
      }
      if (
        recommendedPlayer.flexRank !== undefined &&
        recommendedPlayer.flexRank !== null
      ) {
        rosterPlayer.flexRank = recommendedPlayer.flexRank;
      }
      mergedRoster.push(rosterPlayer);
    }
  });

  // Sort the mergedRoster based on the original roster order
  mergedRoster.sort((a, b) => (a.rosterOrder || 0) - (b.rosterOrder || 0));

  const rankedAvailablePlayersByPosition = Object.entries(
    availablePlayersByPosition
  ).reduce((acc, [position, players]) => {
    if (position !== "BN") {
      acc[position as RosterSlot] = players
        .filter((player) => player.rank !== null && player.rank !== undefined)
        .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
    }
    return acc;
  }, {} as Record<RosterSlot, DraftedPlayer[]>);

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

  // Add worst ranked FLEX player
  const flexEligiblePlayers = currentRoster.filter(
    (p) => p.flexRank !== undefined && ["RB", "WR", "TE"].includes(p.position)
  );
  if (flexEligiblePlayers.length > 0) {
    const worstFlexPlayer = flexEligiblePlayers
      .filter((player) => player.rank !== null && player.rank !== undefined)
      .reduce((worst, player) =>
        (player.flexRank || Infinity) > (worst.flexRank || Infinity)
          ? player
          : worst
      );
    worstRankedUserPlayersByPosition["FLEX"] = worstFlexPlayer;
  }

  const upgradeOptions: Record<Position, UpgradeOption[]> | null =
    currentRoster && availablePositionPlayers.length > 0
      ? findUpgradeOptions(currentRoster, availablePositionPlayers)
      : null;

  const isLoading =
    isLoadingLeagueData || isLoadingPlayerData || flexQuery.isLoading;
  const error =
    leagueError || playerDataError || (flexQuery.error as Error | null);

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
  };
}

export type LeagueData = ReturnType<typeof useLeagueData>;
