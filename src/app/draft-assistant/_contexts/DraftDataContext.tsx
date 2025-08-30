import React, { createContext, useContext, useCallback, useMemo } from "react";
import {
  useDraftDetails,
  useDraftPicks,
  usePlayersByScoringType,
  useCombinedAggregateAll,
  useSleeperPlayersMetaStatic,
} from "@/app/draft-assistant/_lib/useDraftQueries";
import {
  getDraftRecommendations,
  calculatePositionNeeds,
  calculatePositionCounts,
  ZERO_POSITION_COUNTS,
  calculateTotalRemainingNeeds,
} from "@/lib/draftHelpers";
import { isRankedPlayer } from "@/lib/getPlayers";
import {
  DraftedPlayer,
  RankedPlayer,
  scoringTypeSchema,
  RosterSlot,
} from "@/lib/schemas";
import type { Position } from "../_lib/types";
import { computeBeerSheetsBoard, type LeagueShape } from "@/lib/beersheets";
import { normalizePlayerName } from "@/lib/util";
import { SEASON_WEEKS } from "@/lib/constants";

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
  userRosterSlots: { slot: RosterSlot; player: DraftedPlayer | null }[];
  beerSheetsBoard?: ReturnType<typeof computeBeerSheetsBoard>;
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
    roster: { QB: number; RB: number; WR: number; TE: number; FLEX: number; BENCH: number };
  } | null;
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
  draftWideNeeds: {},
  userRoster: null,
  userRosterSlots: [],
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
  }, [parsedScoring.success, draftDetails?.metadata?.scoring_type]);

  const {
    data: playersMap,
    isLoading: isLoadingPlayers,
    error: errorPlayers,
    refetch: refetchPlayersMap,
    dataUpdatedAt: updatedAtPlayers,
  } = usePlayersByScoringType(scoringType);

  // Sleeper-only BeerSheets board inputs
  const { data: combinedAll } = useCombinedAggregateAll(Boolean(draftDetails));
  const { data: playersMeta } = useSleeperPlayersMetaStatic(
    Boolean(draftDetails)
  );

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

    // Build roster slots (starters + FLEX + BN)
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
    }[] = slotsTemplate.map((slot) => ({
      slot,
      player: null,
    }));

    if (userRoster) {
      const findIndex = (s: RosterSlot) =>
        userRosterSlots.findIndex((x) => x.slot === s && x.player === null);

      userRoster.players.forEach((p) => {
        // Try primary position slot
        const posIndex = findIndex(p.position as RosterSlot);
        if (posIndex !== -1) {
          userRosterSlots[posIndex].player = p;
          return;
        }
        // Try FLEX if eligible
        if ((["RB", "WR", "TE"] as RosterSlot[]).includes(p.position as any)) {
          const flexIndex = findIndex("FLEX");
          if (flexIndex !== -1) {
            userRosterSlots[flexIndex].player = p;
            return;
          }
        }
        // Fallback to bench
        const bnIndex = findIndex("BN");
        if (bnIndex !== -1) {
          userRosterSlots[bnIndex].player = p;
        }
      });
    }
    const nextPickRecommendations = userRoster
      ? getDraftRecommendations(
          availableRankedPlayers,
          userRoster.rosterPositionCounts,
          userRoster.remainingPositionRequirements
        )
      : null;

    const totalRemainingNeeds = calculateTotalRemainingNeeds(currentRosters);

    const beerSheetsBoardRaw =
      scoringType && playersMeta && combinedAll
        ? computeBeerSheetsBoard(
            // adapt combinedAll to minimal SleeperProjection-like array with required fields
            Object.entries(combinedAll).map(
              ([id, e]: any) =>
                ({
                  player_id: id,
                  category: "proj",
                  sport: "nfl",
                  season_type: "regular",
                  season: String(new Date().getFullYear()),
                  player: {
                    first_name: String(e?.name || "").split(" ")[0] || "",
                    last_name:
                      String(e?.name || "")
                        .split(" ")
                        .slice(1)
                        .join(" ") || "",
                    position: e?.position,
                    team: e?.team ?? null,
                  },
                  stats: e?.sleeper?.stats || {},
                  week: null,
                } as any)
            ),
            playersMeta,
            {
              teams: draftDetails.settings?.teams ?? 0,
              slots_qb: draftDetails.settings?.slots_qb ?? 0,
              slots_rb: draftDetails.settings?.slots_rb ?? 0,
              slots_wr: draftDetails.settings?.slots_wr ?? 0,
              slots_te: draftDetails.settings?.slots_te ?? 0,
              slots_k: draftDetails.settings?.slots_k ?? 0,
              slots_def: draftDetails.settings?.slots_def ?? 0,
              slots_flex: draftDetails.settings?.slots_flex ?? 0,
            } as LeagueShape,
            scoringType
          )
        : undefined;

    // Filter to tiered players only
    let beerSheetsBoard = beerSheetsBoardRaw;
    if (beerSheetsBoardRaw && playersMap) {
      const allowedIds = new Set<string>();
      const allowedNames = new Set<string>();
      for (const p of Object.values(playersMap)) {
        const tier = (p as any).tier;
        if (tier == null) continue;
        const pid = String((p as any).player_id ?? (p as any).id ?? "");
        if (pid) allowedIds.add(pid);
        const nm = normalizePlayerName(
          (p as any).full_name ??
            (p as any).name ??
            [(p as any).first_name, (p as any).last_name]
              .filter(Boolean)
              .join(" ")
        );
        if (nm) allowedNames.add(nm);
      }

      beerSheetsBoard = beerSheetsBoardRaw.filter((r) => {
        if (!r) return false;
        const nm = normalizePlayerName(r.name || "");
        return allowedIds.has(r.player_id) || allowedNames.has(nm);
      });
    }

    return {
      recommendations: nextPickRecommendations,
      availablePlayers: availableRankedPlayers,
      userPositionNeeds: userRoster?.remainingPositionRequirements || {},
      userPositionCounts: userRoster?.rosterPositionCounts || {},
      draftWideNeeds: totalRemainingNeeds,
      userRoster: userRoster?.players || null,
      userRosterSlots,
      beerSheetsBoard,
    };
  }, [
    draftDetails,
    draftPicks,
    playersMap,
    userId,
    scoringType,
    combinedAll,
    errorDraftDetails,
    errorDraftPicks,
    errorPlayers,
  ]);

  const contextValue = useMemo(
    () => ({
      ...processedData,
      loading,
      error,
      refetchData,
      league:
        draftDetails && scoringType
          ? {
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
            }
          : null,
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
      draftDetails,
      scoringType,
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
      picks: Array.isArray((processedData as any)?.userRoster)
        ? (processedData as any).userRoster.length
        : draftPicks?.length ?? 0,
      playersMapSize: playersMap ? Object.keys(playersMap).length : 0,
      projectionsLen: combinedAll ? Object.keys(combinedAll).length : 0,
      beerSheetsBoardLen: (processedData as any)?.beerSheetsBoard
        ? (processedData as any).beerSheetsBoard.length
        : 0,
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
    combinedAll,
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
