import React, { createContext, useContext, useCallback, useMemo } from "react";
import {
  useDraftDetails,
  useDraftPicks,
  usePlayersByScoringType,
} from "@/app/draft-assistant/_lib/useDraftQueries";
import { buildDraftViewModel } from "@/lib/draftState";
import type { DraftViewModel } from "@/lib/draftState";
import type { DraftedPlayer, RankedPlayer, RosterSlot } from "@/lib/schemas";
import { scoringTypeSchema } from "@/lib/schemas";
import type { Position } from "../_lib/types";
import type { BeerRow } from "@/lib/beersheets";
// BeerSheets removed from client; calculations moved server-side

interface Recommendation {
  keyPositions: RankedPlayer[];
  bestAvailable: RankedPlayer[];
  backups: RankedPlayer[];
  nonKeyPositions: RankedPlayer[];
}

interface ProcessedData {
  recommendations: Recommendation | null;
  availablePlayers: RankedPlayer[];
  availableByPosition?: Record<string, RankedPlayer[]>;
  topAvailablePlayersByPosition?: Record<string, RankedPlayer[]>;
  userPositionNeeds: Partial<Record<Position, number>>;
  userPositionCounts: Partial<Record<Position, number>>;
  userPositionRequirements: Partial<Record<Position, number>>;
  draftWideNeeds: Partial<Record<Position, number>>;
  userRoster: DraftedPlayer[] | null;
  userRosterSlots: { slot: RosterSlot; player: DraftedPlayer | null }[];
  beerSheetsBoard?: BeerRow[]; // Beer sheets board data
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
  // Minimal league shape for enrichment/UIs
  league: {
    teams: number;
    scoring: ReturnType<typeof scoringTypeSchema.parse> | undefined;
    roster: {
      QB: number;
      RB: number;
      WR: number;
      TE: number;
      FLEX: number;
      BENCH: number;
    };
  } | null;
  refetchData: () => void;
  lastUpdatedAt: number | null;
}

const defaultContextValue: DraftDataContextType = {
  recommendations: null,
  availablePlayers: [],
  userPositionNeeds: {},
  userPositionCounts: {},
  userPositionRequirements: {},
  draftWideNeeds: {},
  userRoster: null,
  userRosterSlots: [],
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
  league: null,
  refetchData: () => {},
  lastUpdatedAt: null,
};

const EMPTY_PROCESSED: ProcessedData = {
  recommendations: null,
  availablePlayers: [],
  userPositionNeeds: {},
  userPositionCounts: {},
  userPositionRequirements: {},
  draftWideNeeds: {},
  userRoster: null,
  userRosterSlots: [],
  beerSheetsBoard: [],
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
  const readyIds = Boolean(userId && draftId);
  const {
    data: draftDetails,
    isLoading: isLoadingDraftDetails,
    error: errorDraftDetails,
    refetch: refetchDraftDetails,
    dataUpdatedAt: updatedAtDraftDetails,
  } = useDraftDetails(draftId, { enabled: readyIds, refetchInterval: 3000 });

  const {
    data: draftPicks,
    isLoading: isLoadingDraftPicks,
    error: errorDraftPicks,
    refetch: refetchDraftPicks,
    dataUpdatedAt: updatedAtDraftPicks,
  } = useDraftPicks(draftId, { enabled: readyIds, refetchInterval: 3000 });

  const parsedScoring = scoringTypeSchema.safeParse(
    draftDetails?.metadata?.scoring_type
  );
  const scoringType = React.useMemo(() => {
    if (parsedScoring.success) return parsedScoring.data;
    const raw = (draftDetails?.metadata?.scoring_type || "")
      .toString()
      .toLowerCase();
    switch (raw) {
      case "ppr":
      case "full_ppr":
        return "ppr" as const;
      case "half":
      case "half_ppr":
        return "half" as const;
      case "std":
      case "standard":
      case "non_ppr":
        return "std" as const;
      default:
        return undefined;
    }
  }, [
    parsedScoring.success,
    parsedScoring.data,
    draftDetails?.metadata?.scoring_type,
  ]);

  const {
    data: playersMap,
    isLoading: isLoadingPlayers,
    error: errorPlayers,
    refetch: refetchPlayersMap,
    dataUpdatedAt: updatedAtPlayers,
  } = usePlayersByScoringType(scoringType, {
    enabled: readyIds && Boolean(scoringType),
  });

  // Client-computed view-model handles available, needs, recommendations

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

  // Log errors to console to aid debugging
  React.useEffect(() => {
    if (errorDraftDetails) {
      // eslint-disable-next-line no-console
      console.error("draftDetails error", {
        draftId,
        error: errorDraftDetails,
      });
    }
    if (errorDraftPicks) {
      // eslint-disable-next-line no-console
      console.error("draftPicks error", { draftId, error: errorDraftPicks });
    }
    if (errorPlayers) {
      // eslint-disable-next-line no-console
      console.error("playersMap error", { error: errorPlayers });
    }
  }, [errorDraftDetails, errorDraftPicks, errorPlayers, draftId]);

  const refetchData = useCallback(() => {
    refetchDraftDetails();
    refetchDraftPicks();
    refetchPlayersMap();
  }, [refetchDraftDetails, refetchDraftPicks, refetchPlayersMap]);

  // React Query already refetches when keys change; manual refetch is for explicit refresh

  const processedData: ProcessedData = useMemo(() => {
    if (!draftDetails || !playersMap) return EMPTY_PROCESSED;
    const vm: DraftViewModel = buildDraftViewModel({
      playersMap: playersMap as unknown as Record<string, DraftedPlayer>,
      draft: draftDetails,
      picks: draftPicks || [],
      userId,
      topLimit: 3,
    });

    const startersCount =
      (draftDetails.settings?.slots_qb ?? 0) +
      (draftDetails.settings?.slots_rb ?? 0) +
      (draftDetails.settings?.slots_wr ?? 0) +
      (draftDetails.settings?.slots_te ?? 0) +
      (draftDetails.settings?.slots_k ?? 0) +
      (draftDetails.settings?.slots_def ?? 0) +
      (draftDetails.settings?.slots_flex ?? 0);
    const rounds = draftDetails.settings?.rounds ?? 0;
    const benchCount = Math.max(0, rounds - startersCount);
    const slotsTemplate: RosterSlot[] = [
      ...Array.from(
        { length: draftDetails.settings?.slots_qb ?? 0 },
        () => "QB" as RosterSlot
      ),
      ...Array.from(
        { length: draftDetails.settings?.slots_rb ?? 0 },
        () => "RB" as RosterSlot
      ),
      ...Array.from(
        { length: draftDetails.settings?.slots_wr ?? 0 },
        () => "WR" as RosterSlot
      ),
      ...Array.from(
        { length: draftDetails.settings?.slots_te ?? 0 },
        () => "TE" as RosterSlot
      ),
      ...Array.from(
        { length: draftDetails.settings?.slots_flex ?? 0 },
        () => "FLEX" as RosterSlot
      ),
      ...Array.from(
        { length: draftDetails.settings?.slots_k ?? 0 },
        () => "K" as RosterSlot
      ),
      ...Array.from(
        { length: draftDetails.settings?.slots_def ?? 0 },
        () => "DEF" as RosterSlot
      ),
      ...Array.from({ length: benchCount }, () => "BN" as RosterSlot),
    ];
    const userRosterSlots: {
      slot: RosterSlot;
      player: DraftedPlayer | null;
    }[] = slotsTemplate.map((slot) => ({ slot, player: null }));
    if (vm.userRoster?.players?.length) {
      const findIndex = (s: RosterSlot) =>
        userRosterSlots.findIndex((x) => x.slot === s && x.player === null);
      vm.userRoster.players.forEach((p) => {
        const posIndex = findIndex(p.position as RosterSlot);
        if (posIndex !== -1 && userRosterSlots[posIndex]) {
          userRosterSlots[posIndex].player = p;
          return;
        }
        if (p.position === "RB" || p.position === "WR" || p.position === "TE") {
          const flexIndex = findIndex("FLEX");
          if (flexIndex !== -1 && userRosterSlots[flexIndex]) {
            userRosterSlots[flexIndex].player = p;
            return;
          }
        }
        const bnIndex = findIndex("BN");
        if (bnIndex !== -1 && userRosterSlots[bnIndex]) {
          userRosterSlots[bnIndex].player = p;
        }
      });
    }

    return {
      recommendations: vm.nextPickRecommendations ?? null,
      availablePlayers: vm.available,
      availableByPosition: vm.availableByPosition,
      topAvailablePlayersByPosition: vm.topAvailablePlayersByPosition,
      userPositionNeeds: vm.userRoster?.remainingPositionRequirements || {},
      userPositionCounts: vm.userRoster?.rosterPositionCounts || {},
      userPositionRequirements: vm.rosterRequirements,
      draftWideNeeds: vm.draftWideNeeds || {},
      userRoster: vm.userRoster?.players || null,
      userRosterSlots,
      beerSheetsBoard: [], // TODO: Implement beer sheets board data
    };
  }, [draftDetails, draftPicks, playersMap, userId]);

  // Memoize league object to prevent unnecessary re-renders
  const league = useMemo(() => {
    if (!draftDetails || !scoringType) return null;

    return {
      teams: draftDetails.settings?.teams ?? 0,
      scoring: scoringType,
      roster: {
        QB: draftDetails.settings?.slots_qb ?? 0,
        RB: draftDetails.settings?.slots_rb ?? 0,
        WR: draftDetails.settings?.slots_wr ?? 0,
        TE: draftDetails.settings?.slots_te ?? 0,
        FLEX: draftDetails.settings?.slots_flex ?? 0,
        BENCH:
          (draftDetails.settings?.rounds ?? 0) -
          ((draftDetails.settings?.slots_qb ?? 0) +
            (draftDetails.settings?.slots_rb ?? 0) +
            (draftDetails.settings?.slots_wr ?? 0) +
            (draftDetails.settings?.slots_te ?? 0) +
            (draftDetails.settings?.slots_k ?? 0) +
            (draftDetails.settings?.slots_def ?? 0) +
            (draftDetails.settings?.slots_flex ?? 0)),
      },
    };
  }, [draftDetails, scoringType]);

  const contextValue = useMemo(
    () => ({
      ...processedData,
      loading,
      error,
      refetchData,
      league,
      lastUpdatedAt:
        Math.max(
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
      league,
      updatedAtDraftDetails,
      updatedAtDraftPicks,
      updatedAtPlayers,
    ]
  );

  // Snapshot key data counts when they change
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("DraftData snapshot", {
      draftId,
      hasDetails: Boolean(draftDetails),
      picks: Array.isArray(processedData?.userRoster)
        ? processedData.userRoster.length
        : draftPicks?.length ?? 0,
      playersMapSize: playersMap ? Object.keys(playersMap).length : 0,
      projectionsLen: 0,
      beerSheetsBoardLen: 0,
      errors: {
        draftDetails: Boolean(errorDraftDetails),
        draftPicks: Boolean(errorDraftPicks),
        players: Boolean(errorPlayers),
      },
    });
  }, [
    draftId,
    draftDetails,
    draftPicks,
    playersMap,
    processedData,
    errorDraftDetails,
    errorDraftPicks,
    errorPlayers,
  ]);

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
