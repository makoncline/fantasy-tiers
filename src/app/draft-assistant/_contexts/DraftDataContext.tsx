import React, { createContext, useContext, useCallback, useMemo } from "react";
import {
  useDraftDetails,
  useDraftPicks,
  usePlayersByScoringType,
} from "@/app/draft-assistant/_lib/useDraftQueries";
import {
  getDraftRecommendations,
  calculatePositionNeeds,
  calculatePositionCounts,
  ZERO_POSITION_COUNTS,
  calculateTotalRemainingNeeds,
} from "@/lib/draftHelpers";
import { isRankedPlayer } from "@/lib/getPlayers";
import { DraftedPlayer, RankedPlayer, scoringTypeSchema } from "@/lib/schemas";
import type { Position } from "../_lib/types";

interface Recommendation {
  keyPositions: RankedPlayer[];
  bestAvailable: RankedPlayer[];
  backups: RankedPlayer[];
  nonKeyPositions: RankedPlayer[];
}

interface ProcessedData {
  recommendations: Recommendation | null;
  availablePlayers: RankedPlayer[];
  userPositionNeeds: Partial<Record<Position, number>>;
  userPositionCounts: Partial<Record<Position, number>>;
  draftWideNeeds: Partial<Record<Position, number>>;
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
  lastUpdatedAt: number | null;
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
  lastUpdatedAt: null,
};

const EMPTY_PROCESSED: ProcessedData = {
  recommendations: null,
  availablePlayers: [],
  userPositionNeeds: {},
  userPositionCounts: {},
  draftWideNeeds: {},
  userRoster: null,
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
    dataUpdatedAt: updatedAtDraftDetails,
  } = useDraftDetails(draftId);

  const {
    data: draftPicks,
    isLoading: isLoadingDraftPicks,
    error: errorDraftPicks,
    refetch: refetchDraftPicks,
    dataUpdatedAt: updatedAtDraftPicks,
  } = useDraftPicks(draftId);

  const parsedScoring = scoringTypeSchema.safeParse(
    draftDetails?.metadata?.scoring_type
  );
  const scoringType = parsedScoring.success ? parsedScoring.data : undefined;

  const {
    data: playersMap,
    isLoading: isLoadingPlayers,
    error: errorPlayers,
    refetch: refetchPlayersMap,
    dataUpdatedAt: updatedAtPlayers,
  } = usePlayersByScoringType(scoringType);

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

  // React Query already refetches when keys change; manual refetch is for explicit refresh

  const processedData: ProcessedData = useMemo(() => {
    if (!draftDetails || !draftPicks || !playersMap) {
      return EMPTY_PROCESSED;
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

    const rosterRequirements: Record<Position | "BN", number> = {
      QB: draftDetails.settings?.slots_qb ?? 0,
      RB: draftDetails.settings?.slots_rb ?? 0,
      WR: draftDetails.settings?.slots_wr ?? 0,
      TE: draftDetails.settings?.slots_te ?? 0,
      K: draftDetails.settings?.slots_k ?? 0,
      DEF: draftDetails.settings?.slots_def ?? 0,
      FLEX: draftDetails.settings?.slots_flex ?? 0,
      BN: 0,
    };

    const teams = draftDetails.settings?.teams ?? 0;
    const draftSlots = Array.from({ length: teams }, (_, i) => i + 1);
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
      return EMPTY_PROCESSED;
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
      lastUpdatedAt: Math.max(
        0,
        updatedAtDraftDetails || 0,
        updatedAtDraftPicks || 0,
        updatedAtPlayers || 0
      ) || null,
    }),
    [
      processedData,
      loading,
      error,
      refetchData,
      updatedAtDraftDetails,
      updatedAtDraftPicks,
      updatedAtPlayers,
    ]
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
