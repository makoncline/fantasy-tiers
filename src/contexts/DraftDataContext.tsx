import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  useDraftDetails,
  useDraftPicks,
  usePlayersByScoringType,
} from "@/lib/useDraftQueries";
import {
  getDraftRecommendations,
  calculatePositionNeeds,
  calculatePositionCounts,
  ZERO_POSITION_COUNTS,
  calculateTotalRemainingNeeds,
} from "@/lib/draftHelpers";
import { isRankedPlayer } from "@/lib/getPlayers";
import { DraftedPlayer, Player, RankedPlayer } from "@/lib/schemas";

// Define a new interface for the recommendation structure
interface Recommendation {
  keyPositions: RankedPlayer[];
  bestAvailable: RankedPlayer[];
  backups: RankedPlayer[];
  nonKeyPositions: RankedPlayer[];
}

interface ProcessedData {
  recommendations: Recommendation | null;
  availablePlayers: RankedPlayer[];
  userPositionNeeds: Record<string, number>;
  userPositionCounts: Record<string, number>;
  draftWideNeeds: Record<string, number>;
  userRoster: DraftedPlayer[] | null;
}

interface DraftDataContextType extends ProcessedData {
  loading: {
    draftDetails: boolean;
    draftPicks: boolean;
    players: boolean;
  };
  error: {
    draftDetails: Error | null;
    draftPicks: Error | null;
    players: Error | null;
  };
  refetchData: () => void;
}

const defaultContextValue: DraftDataContextType = {
  recommendations: null,
  availablePlayers: [],
  userPositionNeeds: {},
  userPositionCounts: {},
  draftWideNeeds: {},
  userRoster: null,
  loading: {
    draftDetails: false,
    draftPicks: false,
    players: false,
  },
  error: {
    draftDetails: null,
    draftPicks: null,
    players: null,
  },
  refetchData: () => {},
};

const DraftDataContext =
  createContext<DraftDataContextType>(defaultContextValue);

export function DraftDataProvider({
  children,
  userId,
  draftId,
}: {
  children: React.ReactNode;
  userId: string;
  draftId: string;
}) {
  const {
    data: draftDetails,
    isLoading: isLoadingDraftDetails,
    error: errorDraftDetails,
    refetch: refetchDraftDetails,
  } = useDraftDetails(draftId);

  const {
    data: draftPicks,
    isLoading: isLoadingDraftPicks,
    error: errorDraftPicks,
    refetch: refetchDraftPicks,
  } = useDraftPicks(draftId);

  const {
    data: playersMap,
    isLoading: isLoadingPlayers,
    error: errorPlayers,
    refetch: refetchPlayersMap,
  } = usePlayersByScoringType(draftDetails?.metadata?.scoring_type);

  const loading = useMemo(
    () => ({
      draftDetails: isLoadingDraftDetails,
      draftPicks: isLoadingDraftPicks,
      players: isLoadingPlayers,
    }),
    [isLoadingDraftDetails, isLoadingDraftPicks, isLoadingPlayers]
  );

  const error = useMemo(
    () => ({
      draftDetails: errorDraftDetails,
      draftPicks: errorDraftPicks,
      players: errorPlayers,
    }),
    [errorDraftDetails, errorDraftPicks, errorPlayers]
  );

  const refetchData = useCallback(() => {
    refetchDraftDetails();
    refetchDraftPicks();
    refetchPlayersMap();
  }, [refetchDraftDetails, refetchDraftPicks, refetchPlayersMap]);

  // Automatically refetch data when userId or draftId changes
  useEffect(() => {
    if (userId && draftId) {
      refetchData();
    }
  }, [userId, draftId, refetchData]);

  const processedData: ProcessedData = useMemo(() => {
    if (!draftDetails || !draftPicks || !playersMap) {
      return defaultContextValue;
    }

    const draftedPlayers = draftPicks.map((pick) => ({
      ...pick,
      ...(playersMap[pick.player_id] || {}),
    }));
    const draftedPlayerIds = draftedPlayers.map((player) => player.player_id);

    const rankedPlayers = Object.values(playersMap)
      .filter(isRankedPlayer)
      .sort((a, b) => a.rank - b.rank);
    const availableRankedPlayers = rankedPlayers.filter(
      (player) => !draftedPlayerIds.includes(player.player_id)
    );

    const rosterRequirements = {
      QB: draftDetails.settings.slots_qb,
      RB: draftDetails.settings.slots_rb,
      WR: draftDetails.settings.slots_wr,
      TE: draftDetails.settings.slots_te,
      K: draftDetails.settings.slots_k,
      DEF: draftDetails.settings.slots_def,
      FLEX: draftDetails.settings.slots_flex,
    };

    const draftSlots = Array.from(
      { length: draftDetails.settings.teams },
      (_, i) => i + 1
    );
    const emptyRoster = {
      players: [] as DraftedPlayer[],
      remainingPositionRequirements: { ...rosterRequirements },
      rosterPositionCounts: { ...ZERO_POSITION_COUNTS },
    };
    const currentRosters: Record<string, typeof emptyRoster> = {};
    draftSlots.forEach((draftSlot) => {
      const rosteredPlayers = draftedPlayers.filter(
        (player) => player.draft_slot === draftSlot
      );
      const remainingPositionRequirements = calculatePositionNeeds(
        rosterRequirements,
        rosteredPlayers
      );
      const rosterPositionCounts = calculatePositionCounts(rosteredPlayers);
      currentRosters[draftSlot] = {
        players: rosteredPlayers,
        remainingPositionRequirements,
        rosterPositionCounts,
      };
    });

    const draftSlot = draftDetails.draft_order?.[userId];

    if (!draftSlot) {
      return defaultContextValue;
    }

    const userRoster = currentRosters[draftSlot];
    const nextPickRecommendations = userRoster
      ? getDraftRecommendations(
          availableRankedPlayers,
          userRoster.rosterPositionCounts,
          userRoster.remainingPositionRequirements
        )
      : null;

    const totalRemainingNeeds = calculateTotalRemainingNeeds(currentRosters);

    return {
      recommendations: nextPickRecommendations,
      availablePlayers: availableRankedPlayers,
      userPositionNeeds: userRoster?.remainingPositionRequirements || {},
      userPositionCounts: userRoster?.rosterPositionCounts || {},
      draftWideNeeds: totalRemainingNeeds,
      userRoster: userRoster?.players || null,
    };
  }, [draftDetails, draftPicks, playersMap, userId]);

  const contextValue = useMemo(
    () => ({
      ...processedData,
      loading,
      error,
      refetchData,
    }),
    [processedData, loading, error, refetchData]
  );

  return (
    <DraftDataContext.Provider value={contextValue}>
      {children}
    </DraftDataContext.Provider>
  );
}

export function useDraftData() {
  const context = useContext(DraftDataContext);
  if (context === undefined) {
    throw new Error("useDraftData must be used within a DraftDataProvider");
  }
  return context;
}
