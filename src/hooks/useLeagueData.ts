import { useQueries, useQuery } from "@tanstack/react-query";
import { getPlayersByScoringTypeClient } from "@/lib/getPlayersClient";
import {
  DraftedPlayer,
  ScoringType,
  RosterSlotEnum,
  Position,
  PlayerWithRankings,
} from "@/lib/schemas";
import { useMemo } from "react";

interface Roster {
  roster_id: number;
  owner_id: string;
  players: string[];
  // Add other fields as needed
}

interface LeagueDetails {
  scoring_settings: {
    rec: number;
    // Add other scoring settings as needed
  };
  // Add other league details as needed
}

interface UserPlayerWithDetails extends PlayerWithRankings {
  rosterId: number;
}

interface StartingPlayer extends DraftedPlayer {
  startingPosition: string;
}

interface RosterPlayer extends DraftedPlayer {
  slot: string;
}

interface UpgradeOption {
  currentPlayer: DraftedPlayer;
  availablePlayer: DraftedPlayer;
  positionImprovement: number;
}

interface UpgradesByPosition {
  [key: string]: UpgradeOption[];
}

async function fetchLeagueData(leagueId: string) {
  if (!leagueId) throw new Error("League ID is required");

  const [rostersResponse, leagueDetailsResponse] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}`),
  ]);
  if (!rostersResponse.ok || !leagueDetailsResponse.ok) {
    throw new Error("Failed to fetch league data");
  }

  const rosters: Roster[] = await rostersResponse.json();
  const leagueDetails: LeagueDetails = await leagueDetailsResponse.json();

  return { rosters, leagueDetails };
}

function determineScoringType(
  scoringSettings: LeagueDetails["scoring_settings"]
): ScoringType {
  const recPoints = scoringSettings.rec || 0;
  if (recPoints === 0) return "std";
  if (recPoints === 0.5) return "half";
  if (recPoints === 1) return "ppr";
  // If it's not a standard value, we'll default to PPR
  return "std";
}

function getScoringTypeForPosition(
  position: string,
  leagueScoringType: ScoringType
): ScoringType {
  if (["QB", "K", "DEF"].includes(position)) {
    return "std";
  }
  return leagueScoringType;
}

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
    cacheTime: 0, // Disable caching for league data
    staleTime: 0, // Consider league data stale immediately
  });

  const leagueScoringType = leagueData
    ? determineScoringType(leagueData.leagueDetails.scoring_settings)
    : null;

  const playerQueries = useQueries({
    queries: RosterSlotEnum.options
      .filter((position) => position !== "FLEX")
      .map((position) => ({
        queryKey: ["playerData", leagueScoringType, position],
        queryFn: () =>
          getPlayersByScoringTypeClient(
            leagueScoringType as ScoringType,
            position
          ),
        enabled: !!leagueScoringType,
        // Keep default caching behavior for player data
      })),
  });

  const flexQuery = useQuery({
    queryKey: ["playerData", leagueScoringType, "FLEX"],
    queryFn: () =>
      getPlayersByScoringTypeClient(leagueScoringType as ScoringType, "FLEX"),
    enabled: !!leagueScoringType,
  });

  // Add logging for FLEX query
  console.log("FLEX Query Status:", flexQuery.status);
  console.log("FLEX Query Data:", flexQuery.data);
  console.log("FLEX Query Error:", flexQuery.error);

  const isLoadingPlayerData =
    playerQueries.some((query) => query.isLoading) || flexQuery.isLoading;
  const playerDataError =
    (playerQueries.find((query) => query.error)?.error as Error | null) ||
    (flexQuery.error as Error | null);

  const aggregatedPlayerData = playerQueries.reduce((acc, query, index) => {
    if (query.data) {
      const position = RosterSlotEnum.options.filter((pos) => pos !== "FLEX")[
        index
      ];
      acc[position] = query.data;
    }
    return acc;
  }, {} as Record<Position, Record<string, DraftedPlayer>>);

  const flexPlayers = flexQuery.data || {};
  console.log("Processed FLEX Players:", flexPlayers);

  const rosters = leagueData?.rosters || [];
  const userRoster =
    rosters.find((roster) => roster.owner_id === userId) || null;
  console.log(JSON.stringify(userRoster, null, 2));
  const rosteredPlayerIds = rosters.flatMap((roster) => roster.players);

  const userPlayersWithDetails: DraftedPlayer[] = userRoster
    ? userRoster.players
        .map((playerId) => {
          for (const positionPlayers of Object.values(aggregatedPlayerData)) {
            if (playerId in positionPlayers) return positionPlayers[playerId];
          }
          return flexPlayers[playerId];
        })
        .filter((player): player is DraftedPlayer => player !== undefined)
    : [];

  const determineCurrentRoster = (
    roster: any,
    players: DraftedPlayer[],
    rosterPositions: string[]
  ): RosterPlayer[] => {
    const rosterPlayers: RosterPlayer[] = [];
    const playerMap = players.reduce((acc, player) => {
      acc[player.player_id] = player;
      return acc;
    }, {} as Record<string, DraftedPlayer>);

    // Fill starter positions first
    roster.starters.forEach((starterId: string, index: number) => {
      if (starterId === "0") {
        // Empty slot
        rosterPlayers.push({
          player_id: `empty_${index}`,
          name: "Empty",
          position: "Empty",
          team: null,
          bye_week: null,
          rank: null,
          tier: null,
          slot: rosterPositions[index] || "BN",
        });
      } else {
        const player = playerMap[starterId];
        if (player) {
          rosterPlayers.push({
            ...player,
            slot: rosterPositions[index] || "BN",
          });
        }
      }
    });

    // Add remaining players to bench
    roster.players.forEach((playerId: string) => {
      if (!roster.starters.includes(playerId)) {
        const player = playerMap[playerId];
        if (player) {
          rosterPlayers.push({
            ...player,
            slot: "BN",
          });
        }
      }
    });

    return rosterPlayers;
  };

  const determineRecommendedRoster = (
    players: DraftedPlayer[],
    rosterPositions: string[]
  ): RosterPlayer[] => {
    const rosterPlayers: RosterPlayer[] = [];
    const availablePlayers = [...players].sort(
      (a, b) => (a.rank || Infinity) - (b.rank || Infinity)
    );

    console.log(
      "Sorted players:",
      availablePlayers.map((p) => `${p.name} (${p.position}): Rank ${p.rank}`)
    );

    // Fill non-bench positions first
    rosterPositions.forEach((slot) => {
      if (slot === "BN") return;

      console.log(`Filling slot: ${slot}`);

      let eligiblePlayers: DraftedPlayer[];
      if (slot === "FLEX") {
        eligiblePlayers = availablePlayers.filter((p) =>
          ["RB", "WR", "TE"].includes(p.position)
        );
      } else {
        eligiblePlayers = availablePlayers.filter((p) => p.position === slot);
      }

      console.log(
        `Eligible players for ${slot}:`,
        eligiblePlayers.map((p) => `${p.name}: Rank ${p.rank}`)
      );

      const bestPlayer = eligiblePlayers[0]; // Get the best ranked eligible player
      if (bestPlayer) {
        console.log(
          `Selected player for ${slot}: ${bestPlayer.name} (Rank ${bestPlayer.rank})`
        );
        rosterPlayers.push({ ...bestPlayer, slot });
        availablePlayers.splice(availablePlayers.indexOf(bestPlayer), 1);
      } else {
        console.log(`No eligible player found for ${slot}`);
      }
    });

    // Fill bench positions with remaining players
    availablePlayers.forEach((player) => {
      rosterPlayers.push({ ...player, slot: "BN" });
    });

    console.log(
      "Final recommended roster:",
      rosterPlayers.map((p) => `${p.name} (${p.position}): ${p.slot}`)
    );

    return rosterPlayers;
  };

  const currentRoster =
    userRoster &&
    userPlayersWithDetails.length > 0 &&
    leagueData?.leagueDetails?.roster_positions
      ? determineCurrentRoster(
          userRoster,
          userPlayersWithDetails,
          leagueData.leagueDetails.roster_positions
        )
      : [];

  const recommendedRoster =
    userPlayersWithDetails.length > 0 &&
    leagueData?.leagueDetails?.roster_positions
      ? determineRecommendedRoster(
          userPlayersWithDetails,
          leagueData.leagueDetails.roster_positions
        )
      : [];

  const topAvailablePlayersByPosition = useMemo(() => {
    if (
      !aggregatedPlayerData ||
      Object.keys(aggregatedPlayerData).length === 0
    ) {
      return {};
    }

    return RosterSlotEnum.options.reduce((acc, position) => {
      const positionPlayers =
        position === "FLEX"
          ? Object.values(flexPlayers)
          : Object.values(aggregatedPlayerData[position as Position] || {});

      console.log(`Available players for ${position}:`, positionPlayers.length);

      const availablePlayers = positionPlayers.filter(
        (player) => !rosteredPlayerIds.includes(player.player_id)
      );

      console.log(
        `Filtered available players for ${position}:`,
        availablePlayers.length
      );

      acc[position] = availablePlayers
        .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity))
        .slice(0, 5);

      console.log(
        `Top 5 available players for ${position}:`,
        acc[position].map((p) => p.name)
      );

      return acc;
    }, {} as Record<string, DraftedPlayer[]>);
  }, [aggregatedPlayerData, flexPlayers, rosteredPlayerIds]);

  const findUpgradeOptions = (
    currentRoster: RosterPlayer[],
    availablePlayers: Record<string, DraftedPlayer[]>
  ): UpgradesByPosition => {
    const upgradeOptions: UpgradesByPosition = {};

    currentRoster.forEach((rosterPlayer) => {
      if (rosterPlayer.slot === "BN") return; // Skip bench players

      const positionToCheck =
        rosterPlayer.slot === "FLEX" ? "FLEX" : rosterPlayer.position;
      const betterPlayers =
        availablePlayers[positionToCheck]?.filter(
          (availablePlayer) =>
            (availablePlayer.rank || Infinity) < (rosterPlayer.rank || Infinity)
        ) || [];

      betterPlayers.forEach((betterPlayer) => {
        if (!upgradeOptions[positionToCheck]) {
          upgradeOptions[positionToCheck] = [];
        }
        upgradeOptions[positionToCheck].push({
          currentPlayer: rosterPlayer,
          availablePlayer: betterPlayer,
          positionImprovement:
            (rosterPlayer.rank || Infinity) - (betterPlayer.rank || Infinity),
        });
      });
    });

    // Sort upgrades within each position
    Object.keys(upgradeOptions).forEach((position) => {
      upgradeOptions[position].sort(
        (a, b) => b.positionImprovement - a.positionImprovement
      );
    });

    return upgradeOptions;
  };

  const upgradeOptions = useMemo(() => {
    if (!currentRoster || !topAvailablePlayersByPosition) return {};
    return findUpgradeOptions(currentRoster, topAvailablePlayersByPosition);
  }, [currentRoster, topAvailablePlayersByPosition]);

  const isLoading = isLoadingLeagueData || isLoadingPlayerData;
  const error = leagueError || playerDataError;

  return {
    rosters,
    userRoster,
    rosteredPlayerIds,
    scoringType: leagueScoringType,
    leagueDetails: leagueData?.leagueDetails,
    recommendedRoster,
    currentRoster,
    isLoading,
    error: error as Error | null,
    topAvailablePlayersByPosition,
    upgradeOptions,
    refetchData,
  };
}
