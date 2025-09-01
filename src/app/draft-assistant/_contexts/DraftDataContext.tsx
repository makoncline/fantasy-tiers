import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  useDraftDetails,
  useDraftPicks,
  useAggregatesBundle,
} from "@/app/draft-assistant/_lib/useDraftQueries";
import {
  useSleeperUserByUsername,
  useSleeperUserById,
  useSleeperDrafts,
} from "@/app/draft-assistant/_lib/useSleeper";
import { buildDraftViewModel } from "@/lib/draftState";
import type { DraftViewModel } from "@/lib/draftState";
import type {
  DraftedPlayer,
  RankedPlayer,
  RosterSlot,
  DraftPick,
} from "@/lib/schemas";
import { scoringTypeSchema } from "@/lib/schemas";
import type { SleeperUser, SleeperDraftSummary } from "@/lib/sleeper";
import type { DraftDetails } from "@/lib/draftDetails";
import type { Position } from "../_lib/types";
import type { BeerRow } from "@/lib/beersheets";
import type { AggregatesBundleResponseT } from "@/lib/schemas-bundle";
import type { PlayerRow } from "@/lib/playerRows";
import { toPlayerRowsFromBundle } from "@/lib/playerRows";
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
  positionRows?: {
    QB: PlayerRow[];
    RB: PlayerRow[];
    WR: PlayerRow[];
    TE: PlayerRow[];
    K: PlayerRow[];
    DEF: PlayerRow[];
    FLEX: PlayerRow[];
    ALL: PlayerRow[];
  } | null;
}

interface DraftDataContextType extends ProcessedData {
  // Input state and handlers
  username: string;
  setUsername: (username: string) => void;
  loadUserAndDrafts: () => Promise<void>;
  selectedDraftId: string;
  setSelectedDraftId: (draftId: string) => void;

  // Data state
  user: SleeperUser | null;
  drafts: SleeperDraftSummary[];
  draftDetails: DraftDetails | null;
  playersBundle: AggregatesBundleResponseT | null;
  picks: DraftPick[];

  // UI state
  showAll: boolean;
  setShowAll: (show: boolean) => void;
  showDrafted: boolean;
  setShowDrafted: (show: boolean) => void;
  showUnranked: boolean;
  setShowUnranked: (show: boolean) => void;

  // Loading states
  loading: {
    user: boolean;
    drafts: boolean;
    draftDetails: boolean;
    players: boolean;
    picks: boolean;
  };

  // Error states
  error: {
    user: Error | null;
    drafts: Error | null;
    draftDetails: Error | null;
    players: Error | null;
    picks: Error | null;
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
  // Input state
  username: "",
  setUsername: () => {},
  loadUserAndDrafts: async () => {},
  selectedDraftId: "",
  setSelectedDraftId: () => {},

  // Data state
  user: null,
  drafts: [],
  draftDetails: null,
  playersBundle: null,
  picks: [],

  // UI state
  showAll: false,
  setShowAll: () => {},
  showDrafted: false,
  setShowDrafted: () => {},
  showUnranked: false,
  setShowUnranked: () => {},

  // Processed data
  recommendations: null,
  availablePlayers: [],
  userPositionNeeds: {},
  userPositionCounts: {},
  userPositionRequirements: {},
  draftWideNeeds: {},
  userRoster: null,
  userRosterSlots: [],

  // Loading states
  loading: {
    user: false,
    drafts: false,
    draftDetails: false,
    players: false,
    picks: false,
  },

  // Error states
  error: {
    user: null,
    drafts: null,
    draftDetails: null,
    players: null,
    picks: null,
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
  positionRows: null,
};

const DraftDataContext =
  createContext<DraftDataContextType>(defaultContextValue);

export function DraftDataProvider({
  children,
  initialUserId,
  initialDraftId,
}: {
  children: React.ReactNode;
  initialUserId?: string;
  initialDraftId?: string;
}) {
  // Input state
  const [username, setUsername] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState(initialDraftId || "");

  // UI state
  const [showAll, setShowAll] = useState(false);
  const [showDrafted, setShowDrafted] = useState(false);
  const [showUnranked, setShowUnranked] = useState(false);

  // Trigger state for user/drafts loading
  const [shouldLoadUser, setShouldLoadUser] = useState(false);

  // Fetch user by ID when initialUserId is provided
  const {
    data: initialUser,
    isLoading: isLoadingInitialUser,
    error: errorInitialUser,
  } = useSleeperUserById(initialUserId, Boolean(initialUserId));

  // Automatically load data when we get the user from initialUserId
  React.useEffect(() => {
    if (initialUser && initialUser.username && !shouldLoadUser) {
      setUsername(initialUser.username);
      setShouldLoadUser(true);
    }
  }, [initialUser, shouldLoadUser]);

  // User and drafts fetching
  const {
    data: user,
    isLoading: isLoadingUser,
    error: errorUser,
    refetch: refetchUser,
  } = useSleeperUserByUsername(username, shouldLoadUser);

  const currentYear = String(new Date().getFullYear());
  const {
    data: drafts,
    isLoading: isLoadingDrafts,
    error: errorDrafts,
    refetch: refetchDrafts,
  } = useSleeperDrafts(
    user?.user_id,
    currentYear,
    shouldLoadUser && Boolean(user?.user_id)
  );

  // Draft details and picks fetching
  const {
    data: draftDetails,
    isLoading: isLoadingDraftDetails,
    error: errorDraftDetails,
    refetch: refetchDraftDetails,
    dataUpdatedAt: updatedAtDraftDetails,
  } = useDraftDetails(selectedDraftId, {
    enabled: Boolean(selectedDraftId),
    refetchInterval: 3000,
  });

  const {
    data: picks,
    isLoading: isLoadingPicks,
    error: errorPicks,
    refetch: refetchPicks,
    dataUpdatedAt: updatedAtPicks,
  } = useDraftPicks(selectedDraftId, {
    enabled: Boolean(selectedDraftId),
    refetchInterval: 3000,
  });

  // Parse scoring type from draft details
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

  // Build league object from draft details
  const league = useMemo(() => {
    if (!draftDetails || !scoringType) return null;

    const leagueObj = {
      teams: draftDetails.settings?.teams ?? 0,
      scoring: scoringType,
      roster: {
        QB: draftDetails.settings?.slots_qb ?? 0,
        RB: draftDetails.settings?.slots_rb ?? 0,
        WR: draftDetails.settings?.slots_wr ?? 0,
        TE: draftDetails.settings?.slots_te ?? 0,
        K: draftDetails.settings?.slots_k ?? 0,
        DEF: draftDetails.settings?.slots_def ?? 0,
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

    console.log("DraftDataContext: League object constructed:", leagueObj);
    return leagueObj;
  }, [draftDetails, scoringType]);

  // Players bundle fetching
  const {
    data: playersBundle,
    isLoading: isLoadingPlayers,
    error: errorPlayers,
    refetch: refetchPlayers,
    dataUpdatedAt: updatedAtPlayers,
  } = useAggregatesBundle(league, {
    enabled: Boolean(league),
  });

  // Handlers
  const loadUserAndDrafts = useCallback(async () => {
    if (!username.trim()) {
      throw new Error("Username is required");
    }
    setShouldLoadUser(true);
  }, [username]);

  const handleSetSelectedDraftId = useCallback((draftId: string) => {
    setSelectedDraftId(draftId);
  }, []);

  // Loading and error states
  const loading = useMemo(
    () => ({
      user: isLoadingUser || isLoadingInitialUser,
      drafts: isLoadingDrafts,
      draftDetails: isLoadingDraftDetails,
      players: isLoadingPlayers,
      picks: isLoadingPicks,
    }),
    [
      isLoadingUser,
      isLoadingInitialUser,
      isLoadingDrafts,
      isLoadingDraftDetails,
      isLoadingPlayers,
      isLoadingPicks,
    ]
  );

  const error = useMemo(
    () => ({
      user: errorUser || errorInitialUser,
      drafts: errorDrafts,
      draftDetails: errorDraftDetails,
      players: errorPlayers,
      picks: errorPicks,
    }),
    [
      errorUser,
      errorInitialUser,
      errorDrafts,
      errorDraftDetails,
      errorPlayers,
      errorPicks,
    ]
  );

  // Log errors to console to aid debugging
  React.useEffect(() => {
    if (errorUser) {
      // eslint-disable-next-line no-console
      console.error("user error", { username, error: errorUser });
    }
    if (errorDrafts) {
      // eslint-disable-next-line no-console
      console.error("drafts error", {
        userId: user?.user_id,
        error: errorDrafts,
      });
    }
    if (errorDraftDetails) {
      // eslint-disable-next-line no-console
      console.error("draftDetails error", {
        draftId: selectedDraftId,
        error: errorDraftDetails,
      });
    }
    if (errorPicks) {
      // eslint-disable-next-line no-console
      console.error("draftPicks error", {
        draftId: selectedDraftId,
        error: errorPicks,
      });
    }
    if (errorPlayers) {
      // eslint-disable-next-line no-console
      console.error("players error", { error: errorPlayers });
    }
  }, [
    errorUser,
    errorDrafts,
    errorDraftDetails,
    errorPicks,
    errorPlayers,
    username,
    user?.user_id,
    selectedDraftId,
  ]);

  const refetchData = useCallback(() => {
    refetchUser();
    refetchDrafts();
    refetchDraftDetails();
    refetchPicks();
    refetchPlayers();
  }, [
    refetchUser,
    refetchDrafts,
    refetchDraftDetails,
    refetchPicks,
    refetchPlayers,
  ]);

  // Build position rows from bundle when available
  const positionRows = useMemo(() => {
    if (!playersBundle || !league) return null;

    // Use existing import instead of require
    const result = {
      QB: toPlayerRowsFromBundle(playersBundle.shards.QB, league.teams),
      RB: toPlayerRowsFromBundle(playersBundle.shards.RB, league.teams),
      WR: toPlayerRowsFromBundle(playersBundle.shards.WR, league.teams),
      TE: toPlayerRowsFromBundle(playersBundle.shards.TE, league.teams),
      K: toPlayerRowsFromBundle(playersBundle.shards.K, league.teams),
      DEF: toPlayerRowsFromBundle(playersBundle.shards.DEF, league.teams),
      FLEX: toPlayerRowsFromBundle(playersBundle.shards.FLEX, league.teams),
      ALL: toPlayerRowsFromBundle(playersBundle.shards.ALL, league.teams),
    } as const;

    console.log("PositionRows created successfully");
    console.log("QB length:", result.QB.length);
    console.log("RB length:", result.RB.length);
    console.log("WR length:", result.WR.length);
    console.log("TE length:", result.TE.length);
    console.log("FLEX length:", result.FLEX.length);
    console.log("K length:", result.K.length);
    console.log("DEF length:", result.DEF.length);
    console.log("ALL length:", result.ALL.length);
    console.log("TE sample:", result.TE.slice(0, 3));

    return result;
  }, [playersBundle, league]);

  // Build playersMap from ALL shard for view-model
  const playersMap = useMemo(() => {
    const map: Record<string, DraftedPlayer> = {};
    if (!positionRows) return map;

    // For view-model, use ALL rows (global pool) to include every player exactly once
    for (const r of positionRows.ALL) {
      // rank/tier must exist for Ranked filtering downstream
      map[r.player_id] = {
        player_id: r.player_id,
        name: r.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        position: r.position as any,
        team: r.team,
        bye_week: r.bye_week != null ? String(r.bye_week) : null,
        rank: typeof r.bc_rank === "number" ? r.bc_rank : r.rank ?? null,
        tier: typeof r.bc_tier === "number" ? r.bc_tier : r.tier ?? null,
      };
    }
    return map;
  }, [positionRows]);

  // Build the server-like draft VM on the client
  const viewModel = useMemo(() => {
    if (
      !draftDetails ||
      !playersMap ||
      Object.keys(playersMap).length === 0 ||
      !user?.user_id
    )
      return null;
    return buildDraftViewModel({
      playersMap, // <- use the map from bundle rows
      draft: draftDetails,
      picks: picks || [],
      userId: user.user_id,
      topLimit: 3,
    });
  }, [playersMap, draftDetails, picks, user?.user_id]);

  // Build processed data when all required data is available
  const processedData = useMemo(() => {
    if (!viewModel || !user) {
      return EMPTY_PROCESSED;
    }

    try {
      const result = {
        recommendations: viewModel.nextPickRecommendations,
        availablePlayers: viewModel.available || [],
        availableByPosition: viewModel.availableByPosition,
        topAvailablePlayersByPosition: viewModel.topAvailablePlayersByPosition,
        userPositionNeeds:
          viewModel.userRoster?.remainingPositionRequirements || {},
        userPositionCounts: viewModel.userRoster?.rosterPositionCounts || {},
        userPositionRequirements: viewModel.rosterRequirements,
        draftWideNeeds: viewModel.draftWideNeeds,
        userRoster: viewModel.userRoster?.players || [],
        userRosterSlots: (() => {
          // Build slots template from draft settings
          if (!draftDetails) return [];
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

          const slots: RosterSlot[] = [
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

          const rows = slots.map((slot) => ({
            slot,
            player: null as DraftedPlayer | null,
          }));
          const rosterPlayers = viewModel.userRoster?.players || [];
          if (rosterPlayers.length) {
            const findIndex = (s: RosterSlot) =>
              rows.findIndex((x) => x.slot === s && x.player === null);
            for (const p of rosterPlayers) {
              const pos = p.position as RosterSlot;
              // place in primary slot
              const posIdx = findIndex(pos);
              if (posIdx !== -1 && posIdx < rows.length) {
                rows[posIdx]!.player = p;
                continue;
              }
              // flex allocation if RB/WR/TE
              if (pos === "RB" || pos === "WR" || pos === "TE") {
                const flexIdx = findIndex("FLEX");
                if (flexIdx !== -1 && flexIdx < rows.length) {
                  rows[flexIdx]!.player = p;
                  continue;
                }
              }
              // bench fallback
              const bnIdx = findIndex("BN");
              if (bnIdx !== -1 && bnIdx < rows.length) rows[bnIdx]!.player = p;
            }
          }
          return rows;
        })(),
        beerSheetsBoard: [], // TODO: Implement beer sheets
        positionRows, // expose to tables to avoid recomputing
      };

      return result;
    } catch (error) {
      console.error("Error building processed data:", error);
      return EMPTY_PROCESSED;
    }
  }, [viewModel, user, positionRows, draftDetails]);

  // Context value
  const contextValue = useMemo(
    () => ({
      // Input state and handlers
      username,
      setUsername,
      loadUserAndDrafts,
      selectedDraftId,
      setSelectedDraftId: handleSetSelectedDraftId,

      // Data state
      user: user || null,
      drafts: drafts || [],
      draftDetails,
      playersBundle: playersBundle || null,
      picks: picks || [],

      // UI state
      showAll,
      setShowAll,
      showDrafted,
      setShowDrafted,
      showUnranked,
      setShowUnranked,

      // Processed data - build view model when all data is available
      ...processedData,

      // Loading states
      loading,
      error,

      // League and other data
      league,
      refetchData,
      lastUpdatedAt:
        Math.max(
          0,
          updatedAtDraftDetails || 0,
          updatedAtPicks || 0,
          updatedAtPlayers || 0
        ) || null,
    }),
    [
      username,
      loadUserAndDrafts,
      selectedDraftId,
      handleSetSelectedDraftId,
      user,
      drafts,
      draftDetails,
      playersBundle,
      picks,
      showAll,
      showDrafted,
      showUnranked,
      loading,
      error,
      league,
      refetchData,
      updatedAtDraftDetails,
      updatedAtPicks,
      updatedAtPlayers,
      processedData,
    ]
  );

  // Snapshot key data counts when they change
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("DraftData snapshot", {
      username,
      userId: user?.user_id,
      selectedDraftId,
      hasDetails: Boolean(draftDetails),
      picks: picks?.length ?? 0,
      hasPlayersBundle: Boolean(playersBundle),
      hasLeague: Boolean(league),
      errors: {
        user: Boolean(errorUser),
        drafts: Boolean(errorDrafts),
        draftDetails: Boolean(errorDraftDetails),
        picks: Boolean(errorPicks),
        players: Boolean(errorPlayers),
      },
    });
  }, [
    username,
    user?.user_id,
    selectedDraftId,
    draftDetails,
    picks,
    playersBundle,
    league,
    errorUser,
    errorDrafts,
    errorDraftDetails,
    errorPicks,
    errorPlayers,
  ]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <DraftDataContext.Provider value={contextValue as any}>
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
