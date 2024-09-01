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
    // Keep default caching behavior for FLEX player data
  });

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

    const starterIds: string[] = [];
    const starterPlayers: RosterPlayer[] = [];

    // Fill non-bench positions first
    rosterPositions.forEach((slot) => {
      if (slot === "BN") return;

      let eligiblePlayers: DraftedPlayer[];
      if (slot === "FLEX") {
        eligiblePlayers = availablePlayers.filter((p) =>
          ["RB", "WR", "TE"].includes(p.position)
        );
      } else {
        eligiblePlayers = availablePlayers.filter((p) => p.position === slot);
      }

      const player = eligiblePlayers.shift();
      if (player) {
        const rosterPlayer = { ...player, slot };
        rosterPlayers.push(rosterPlayer);
        starterIds.push(player.player_id);
        starterPlayers.push(rosterPlayer);
        availablePlayers.splice(availablePlayers.indexOf(player), 1);
      }
    });

    // Fill bench positions with remaining players
    availablePlayers.forEach((player) => {
      rosterPlayers.push({ ...player, slot: "BN" });
    });

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
      const positionPlayers = Object.values(
        aggregatedPlayerData[position as Position] || {}
      );
      const availablePlayers = positionPlayers.filter(
        (player) => !rosteredPlayerIds.includes(player.player_id)
      );

      acc[position] = availablePlayers
        .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity))
        .slice(0, 5);

      return acc;
    }, {} as Record<string, DraftedPlayer[]>);
  }, [aggregatedPlayerData, rosteredPlayerIds]);

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
  };
}
