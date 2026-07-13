"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useDraftDetails,
  useDraftPicks,
  useAggregatesBundle,
} from "@/app/draft-assistant/_lib/useDraftQueries";
import {
  useSleeperUserByUsername,
  useSleeperUserById,
  useSleeperDrafts,
  useSleeperNflState,
} from "@/app/draft-assistant/_lib/useSleeper";
import { buildDraftViewModel } from "@/lib/draftState";
import type { DraftContext } from "@/lib/draftState";
import { buildRosterRequirementsFromDraftSettings } from "@/lib/draftHelpers";
import { getSleeperSeasonCandidates } from "@/lib/sleeperSeasons";

import type {
  DraftedPlayer,
  RankedPlayer,
  RosterSlot,
  DraftPick,
  ScoringType,
} from "@/lib/schemas";
import type { SleeperUser, SleeperDraftSummary } from "@/lib/sleeper";
import type { DraftDetails } from "@/lib/draftDetails";
import type { Position } from "../_lib/types";
import type {
  AggregatesBundleResponseT,
  AggregateSourceHealthT,
} from "@/lib/schemas-bundle";
import type { PlayerRow } from "@/lib/playerRows";
import {
  buildPositionTierMapFromBundle,
  toPlayerRowsFromBundle,
} from "@/lib/playerRows";
import type { PlayerWithPick } from "@/lib/types.draft";
import { normalizePick } from "@/lib/normalizePick";
import type { PickMeta } from "@/lib/types.draft";
import {
  attachDraftValueMetrics,
  type DraftRosterConstruction,
} from "@/lib/draftValue";
import { draftCandidateMapFromRows } from "@/lib/draftCandidate";
import { parseSleeperScoringType } from "@/lib/scoring";

interface ProcessedData {
  availablePlayers: RankedPlayer[];
  availableByPosition?: Record<string, RankedPlayer[]>;
  topAvailablePlayersByPosition?: Record<string, RankedPlayer[]>;
  userPositionNeeds: Partial<Record<Position, number>>;
  userPositionCounts: Partial<Record<Position, number>>;
  userPositionRequirements: Partial<Record<RosterSlot, number>>;
  // Helper function to get roster status for a position
  getRosterStatus: (pos: Position) => {
    count: number;
    requirement: number;
    met: boolean;
  };
  draftWideNeeds: Partial<Record<Position, number>>;
  userRoster: DraftedPlayer[] | null;
  userRosterSlots: { slot: RosterSlot; player: DraftedPlayer | null }[];
  decisionRows: PlayerWithPick[];
  topRecommendation: PlayerWithPick | null;
  rosterConstruction: DraftRosterConstruction | null;
  draftContext: DraftContext | null;
  sourceHealth: AggregateSourceHealthT | null;
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

export interface DraftDataContextType extends ProcessedData {
  // Input state and handlers
  username: string;
  setUsername: (username: string) => void;
  loadUserAndDrafts: () => Promise<void>;
  selectedDraftId: string;
  setSelectedDraftId: (draftId: string) => void;
  clearDraft?: () => void;
  clearUser?: () => void;

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
    scoring: ScoringType | undefined;
    roster: {
      QB: number;
      RB: number;
      WR: number;
      TE: number;
      K: number;
      DEF: number;
      FLEX: number;
      BENCH: number;
    };
  } | null;

  refetchData: () => void;
  lastUpdatedAt: number | null;

  // Enriched player data with pick overlay
  playersAll: PlayerWithPick[];
  playersByPosition: {
    QB: PlayerWithPick[];
    RB: PlayerWithPick[];
    WR: PlayerWithPick[];
    TE: PlayerWithPick[];
    K: PlayerWithPick[];
    DEF: PlayerWithPick[];
    FLEX: PlayerWithPick[];
    ALL: PlayerWithPick[];
  } | null;
  draftedIds: Set<string>;
}

const defaultContextValue: DraftDataContextType = {
  // Input state
  username: "",
  setUsername: () => {},
  loadUserAndDrafts: async () => {},
  selectedDraftId: "",
  setSelectedDraftId: () => {},
  clearDraft: () => {},
  clearUser: () => {},

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
  availablePlayers: [],
  userPositionNeeds: {},
  userPositionCounts: {},
  userPositionRequirements: {},
  // Helper function for consistent roster status calculation
  getRosterStatus: () => ({ count: 0, requirement: 0, met: false }),
  draftWideNeeds: {},
  userRoster: null,
  userRosterSlots: [],
  decisionRows: [],
  topRecommendation: null,
  rosterConstruction: null,
  draftContext: null,
  sourceHealth: null,

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

  // Enriched player data with pick overlay
  playersAll: [],
  playersByPosition: null,
  draftedIds: new Set<string>(),
};

const EMPTY_PROCESSED: ProcessedData = {
  availablePlayers: [],
  userPositionNeeds: {},
  userPositionCounts: {},
  userPositionRequirements: {},
  // Helper function for consistent roster status calculation
  getRosterStatus: () => ({ count: 0, requirement: 0, met: false }),
  draftWideNeeds: {},
  userRoster: null,
  userRosterSlots: [],
  decisionRows: [],
  topRecommendation: null,
  rosterConstruction: null,
  draftContext: null,
  sourceHealth: null,
  positionRows: null,
};

const DraftDataContext =
  createContext<DraftDataContextType>(defaultContextValue);

export function DraftDataStaticProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Partial<DraftDataContextType>;
}) {
  const [showAll, setShowAll] = useState(value.showAll ?? false);
  const [showDrafted, setShowDrafted] = useState(value.showDrafted ?? false);
  const [showUnranked, setShowUnranked] = useState(value.showUnranked ?? false);

  const contextValue = useMemo(
    () => ({
      ...defaultContextValue,
      ...value,
      showAll,
      setShowAll,
      showDrafted,
      setShowDrafted,
      showUnranked,
      setShowUnranked,
    }),
    [showAll, showDrafted, showUnranked, value]
  );

  return (
    <DraftDataContext.Provider value={contextValue}>
      {children}
    </DraftDataContext.Provider>
  );
}

export function DraftDataProvider({
  children,
  initialUserId,
  initialDraftId,
}: {
  children: React.ReactNode;
  initialUserId?: string;
  initialDraftId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Merge-write helper: always read the live URL to avoid stale closures
  const setQuery = useCallback(
    (next: Record<string, string | null>) => {
      const src =
        typeof window !== "undefined"
          ? window.location.search
          : searchParams?.toString() ?? "";
      const sp = new URLSearchParams(src);
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `/draft-assistant?${qs}` : `/draft-assistant`, {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  // Input state
  const [username, setUsername] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState(initialDraftId || "");

  // UI state
  const [showAll, setShowAll] = useState(false);
  const [showDrafted, setShowDrafted] = useState(false);
  const [showUnranked, setShowUnranked] = useState(false);

  // Trigger state for user/drafts loading
  const [shouldLoadUser, setShouldLoadUser] = useState(false);
  // Intent gate to prevent re-writing userId after clearing
  const [isExplicitlyLoading, setIsExplicitlyLoading] = useState(false);

  // Fetch user by ID when initialUserId is provided
  const {
    data: initialUser,
    isLoading: isLoadingInitialUser,
    error: errorInitialUser,
  } = useSleeperUserById(initialUserId, Boolean(initialUserId));

  // Automatically load data when we get the user from initialUserId
  React.useEffect(() => {
    if (
      initialUserId &&
      initialUser &&
      initialUser.username &&
      !shouldLoadUser
    ) {
      setUsername(initialUser.username);
      setShouldLoadUser(true);
    }
  }, [initialUserId, initialUser, shouldLoadUser]);

  // Sync selectedDraftId with the initial URL (helps direct deep links)
  React.useEffect(() => {
    if (initialDraftId != null) setSelectedDraftId(initialDraftId);
  }, [initialDraftId]);

  // User and drafts fetching
  const {
    data: user,
    isLoading: isLoadingUser,
    error: errorUser,
    refetch: refetchUser,
  } = useSleeperUserByUsername(username, shouldLoadUser);

  const { data: nflState } = useSleeperNflState({ enabled: shouldLoadUser });
  const draftSeason = useMemo(
    () =>
      getSleeperSeasonCandidates(nflState)[0] ??
      String(new Date().getFullYear()),
    [nflState]
  );
  const {
    data: drafts,
    isLoading: isLoadingDrafts,
    error: errorDrafts,
    refetch: refetchDrafts,
  } = useSleeperDrafts(
    user?.user_id,
    draftSeason,
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
    ...(draftDetails?.settings.teams && draftDetails.settings.rounds
      ? {
          expectedPickCount:
            draftDetails.settings.teams * draftDetails.settings.rounds,
        }
      : {}),
    refetchInterval: 3000,
  });

  // Parse scoring type from draft details
  const scoringType = React.useMemo(() => {
    if (!draftDetails) return undefined;
    return parseSleeperScoringType(draftDetails.metadata?.scoring_type);
  }, [draftDetails]);

  // Build league object from draft details
  const league = useMemo(() => {
    if (!draftDetails || !scoringType) return null;
    const rosterRequirements = buildRosterRequirementsFromDraftSettings(
      draftDetails.settings
    );

    const leagueObj = {
      teams: draftDetails.settings?.teams ?? 0,
      scoring: scoringType,
      roster: {
        QB: rosterRequirements.QB,
        RB: rosterRequirements.RB,
        WR: rosterRequirements.WR,
        TE: rosterRequirements.TE,
        K: rosterRequirements.K,
        DEF: rosterRequirements.DEF,
        FLEX: rosterRequirements.FLEX,
        BENCH: rosterRequirements.BN,
      },
    };

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
    setIsExplicitlyLoading(true);
  }, [username]);

  // When user is loaded, reflect userId in URL exactly once per change
  React.useEffect(() => {
    if (isExplicitlyLoading && shouldLoadUser && user?.user_id) {
      const current = searchParams?.get("userId") || "";
      if (current !== user.user_id) {
        setQuery({ userId: user.user_id });
      }
      setIsExplicitlyLoading(false);
    }
  }, [
    isExplicitlyLoading,
    shouldLoadUser,
    user?.user_id,
    searchParams,
    setQuery,
  ]);

  const handleSetSelectedDraftId = useCallback(
    (draftId: string) => {
      setSelectedDraftId(draftId);
      setQuery({ draftId: draftId || null });
    },
    [setQuery]
  );

  const clearDraft = useCallback(() => {
    setSelectedDraftId("");
    setQuery({ draftId: null });
  }, [setQuery]);

  const clearUser = useCallback(() => {
    setUsername("");
    setShouldLoadUser(false);
    setIsExplicitlyLoading(false);
    setSelectedDraftId("");
    setQuery({ userId: null, draftId: null });
  }, [setQuery]);

  // Loading and error states
  const loading = useMemo(
    () => ({
      user: isLoadingUser || isLoadingInitialUser,
      drafts: selectedDraftId ? false : isLoadingDrafts,
      draftDetails: isLoadingDraftDetails,
      players: isLoadingPlayers,
      picks: isLoadingPicks,
    }),
    [
      isLoadingUser,
      isLoadingInitialUser,
      isLoadingDrafts,
      selectedDraftId,
      isLoadingDraftDetails,
      isLoadingPlayers,
      isLoadingPicks,
    ]
  );

  const error = useMemo(
    () => ({
      user: errorUser || errorInitialUser,
      drafts: selectedDraftId ? null : errorDrafts,
      draftDetails: errorDraftDetails,
      players: errorPlayers,
      picks: errorPicks,
    }),
    [
      errorUser,
      errorInitialUser,
      errorDrafts,
      selectedDraftId,
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
        season: draftSeason,
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
    draftSeason,
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
    const positionTierByPlayerId = buildPositionTierMapFromBundle(playersBundle);
    const positionTierOptions = { tiersArePositionTiers: true };

    // Use existing import instead of require
    const result = {
      QB: toPlayerRowsFromBundle(
        playersBundle.shards.QB,
        league.teams,
        positionTierOptions
      ),
      RB: toPlayerRowsFromBundle(
        playersBundle.shards.RB,
        league.teams,
        positionTierOptions
      ),
      WR: toPlayerRowsFromBundle(
        playersBundle.shards.WR,
        league.teams,
        positionTierOptions
      ),
      TE: toPlayerRowsFromBundle(
        playersBundle.shards.TE,
        league.teams,
        positionTierOptions
      ),
      K: toPlayerRowsFromBundle(
        playersBundle.shards.K,
        league.teams,
        positionTierOptions
      ),
      DEF: toPlayerRowsFromBundle(
        playersBundle.shards.DEF,
        league.teams,
        positionTierOptions
      ),
      FLEX: toPlayerRowsFromBundle(
        playersBundle.shards.FLEX,
        league.teams,
        positionTierOptions
      ),
      ALL: toPlayerRowsFromBundle(playersBundle.shards.ALL, league.teams, {
        positionTierByPlayerId,
      }),
    } as const;

    return result;
  }, [playersBundle, league]);

  // Build playersMap from ALL shard for view-model
  const playersMap = useMemo(() => {
    return positionRows ? draftCandidateMapFromRows(positionRows.ALL) : {};
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
      sourceWarnings: playersBundle?.sourceHealth?.warnings ?? [],
    });
  }, [
    playersMap,
    draftDetails,
    picks,
    playersBundle?.sourceHealth?.warnings,
    user?.user_id,
  ]);

  // Build processed data when all required data is available
  const processedData = useMemo(() => {
    if (!viewModel || !user) {
      return EMPTY_PROCESSED;
    }

    try {
      const result = {
        availablePlayers: viewModel.available || [],
        availableByPosition: viewModel.availableByPosition,
        topAvailablePlayersByPosition: viewModel.topAvailablePlayersByPosition,
        userPositionNeeds:
          viewModel.userRoster?.remainingPositionRequirements || {},
        userPositionCounts: viewModel.userRoster?.rosterPositionCounts || {},
        userPositionRequirements: viewModel.rosterRequirements,
        // Helper function for consistent roster status calculation
        getRosterStatus: (pos: Position) => {
          const count = viewModel.userRoster?.rosterPositionCounts?.[pos] ?? 0;
          const requirement = viewModel.rosterRequirements?.[pos] ?? 0;
          const met = requirement > 0 && count >= requirement;
          return { count, requirement, met };
        },
        draftWideNeeds: viewModel.draftWideNeeds,
        userRoster: viewModel.userRoster?.players || [],
        userRosterSlots: (() => {
          // Build slots template from draft settings
          if (!draftDetails) return [];
          const rosterRequirements = buildRosterRequirementsFromDraftSettings(
            draftDetails.settings
          );
          const benchCount = rosterRequirements.BN;

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
        decisionRows: [],
        topRecommendation: null,
        rosterConstruction: null,
        draftContext: viewModel.draftContext,
        sourceHealth: playersBundle?.sourceHealth ?? null,
        positionRows, // expose to tables to avoid recomputing
      };

      return result;
    } catch (error) {
      console.error("Error building processed data:", error);
      return EMPTY_PROCESSED;
    }
  }, [viewModel, user, positionRows, draftDetails, playersBundle?.sourceHealth]);

  // Build the overlay and enriched lists
  const pickOverlay = useMemo(() => {
    const m = new Map<string, PickMeta>();
    const teams = league?.teams;

    for (const p of picks ?? []) {
      const norm = normalizePick(p, teams ? { teams } : undefined);
      if (!norm) continue;
      m.set(norm.playerId, norm.meta);
    }
    return m;
  }, [picks, league?.teams]);

  // Enriched ALL with pick overlay, before dynamic value calculations
  const playersAllWithPicks: PlayerWithPick[] = useMemo(() => {
    const base = positionRows?.ALL ?? [];
    if (base.length === 0) return [];
    if (pickOverlay.size === 0) return base.map((r) => ({ ...r }));

    const me = user?.user_id;
    return base.map((r) => {
      const meta = pickOverlay.get(r.player_id);
      return meta
        ? { ...r, picked: meta, draftedByMe: meta.drafterId === me }
        : { ...r };
    });
  }, [positionRows, pickOverlay, user?.user_id]);

  const draftValueBoard = viewModel?.recommendationBoard ?? null;

  const attachDraftValue = useCallback(
    (row: PlayerWithPick): PlayerWithPick =>
      attachDraftValueMetrics(
        row,
        draftValueBoard?.metricsByPlayerId[row.player_id]
      ),
    [draftValueBoard]
  );

  const playersAll: PlayerWithPick[] = useMemo(() => {
    if (!draftValueBoard) return playersAllWithPicks;
    return playersAllWithPicks
      .map(attachDraftValue)
      .sort(
        (a, b) =>
          (a.draft_recommendation_rank ?? 999_999) -
            (b.draft_recommendation_rank ?? 999_999) ||
          (a.tier_rank ?? a.rank ?? 999_999) -
            (b.tier_rank ?? b.rank ?? 999_999)
      );
  }, [attachDraftValue, draftValueBoard, playersAllWithPicks]);

  const decisionRows: PlayerWithPick[] = useMemo(() => {
    if (!draftValueBoard) return [];
    return playersAllWithPicks
      .map(attachDraftValue)
      .filter(
        (row) => !row.picked && row.draft_recommendation_rank != null
      )
      .sort(
        (a, b) =>
          (a.draft_recommendation_rank ?? 999_999) -
          (b.draft_recommendation_rank ?? 999_999)
      )
      .slice(0, 12);
  }, [attachDraftValue, draftValueBoard, playersAllWithPicks]);

  // Enriched per-position (preserve order)
  const playersByPosition = useMemo(() => {
    if (!positionRows) return null;

    const me = user?.user_id;
    const enrich = (arr: PlayerRow[]): PlayerWithPick[] =>
      arr
        .map((r) => {
          const meta = pickOverlay.get(r.player_id);
          return meta
            ? { ...r, picked: meta, draftedByMe: meta.drafterId === me }
            : { ...r };
        })
        .map(attachDraftValue);

    return {
      QB: enrich(positionRows.QB),
      RB: enrich(positionRows.RB),
      WR: enrich(positionRows.WR),
      TE: enrich(positionRows.TE),
      K: enrich(positionRows.K),
      DEF: enrich(positionRows.DEF),
      FLEX: enrich(positionRows.FLEX),
      ALL: enrich(positionRows.ALL),
    };
  }, [attachDraftValue, positionRows, pickOverlay, user?.user_id]);

  // Drafted ids for legacy consumers and quick checks
  const draftedIds = useMemo(() => {
    const out = new Set<string>();
    for (const id of pickOverlay.keys()) out.add(id);
    return out;
  }, [pickOverlay]);

  // Context value
  const contextValue: DraftDataContextType = useMemo(
    () => ({
      // Input state and handlers
      username,
      setUsername,
      loadUserAndDrafts,
      selectedDraftId,
      setSelectedDraftId: handleSetSelectedDraftId,
      clearDraft,
      clearUser,

      // Data state
      user: user || null,
      drafts: drafts || [],
      draftDetails: draftDetails || null,
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
      decisionRows,
      topRecommendation: decisionRows[0] ?? null,
      rosterConstruction: draftValueBoard?.rosterConstruction ?? null,
      sourceHealth: playersBundle?.sourceHealth ?? null,

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

      // Enriched player data with pick overlay
      playersAll,
      playersByPosition,
      draftedIds,
    }),
    [
      username,
      loadUserAndDrafts,
      selectedDraftId,
      handleSetSelectedDraftId,
      clearDraft,
      clearUser,
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
      decisionRows,
      draftValueBoard,
      playersAll,
      playersByPosition,
      draftedIds,
    ]
  );

  // Data processing complete

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
