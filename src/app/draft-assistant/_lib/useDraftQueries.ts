import { useQuery } from "@tanstack/react-query";
import { fetchDraftDetails, DraftDetails } from "@/lib/draftDetails";
import { fetchDraftPicks } from "@/lib/draftPicks";
import { fetchMergedAggregates, fetchShard } from "@/lib/api/aggregates";
import { ScoringType, DraftPick, DraftedPlayer } from "@/lib/schemas";
import { qk } from "@/lib/queryKeys";
import { CombinedEntryT, CombinedShard } from "@/lib/schemas-aggregates";
import { SleeperPlayersMeta, SleeperPlayersMetaT } from "@/lib/schemas-sleeper";
import { normalizePlayerName } from "@/lib/util";

type AggregatesLastModifiedResponse = {
  timestamp: number | null;
  formatted: string | null;
};

// Consolidated aggregates query - fetches merged data for compatibility
export function useAggregates(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  return useQuery({
    queryKey: qk.aggregates.merged,
    queryFn: fetchMergedAggregates,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (merged) => {
      const all = Object.values(merged);
      const byId = new Map(all.map((p) => [p.player_id, p]));
      const byName = new Map(all.map((p) => [normalizePlayerName(p.name), p]));
      return {
        all,
        byId,
        byName,
        positions: {
          ALL: all,
          QB: all.filter((p) => p.position === "QB"),
          RB: all.filter((p) => p.position === "RB"),
          WR: all.filter((p) => p.position === "WR"),
          TE: all.filter((p) => p.position === "TE"),
          K: all.filter((p) => p.position === "K"),
          DEF: all.filter((p) => p.position === "DEF"),
          FLEX: all.filter((p) => ["RB", "WR", "TE"].includes(p.position)),
        },
      } as const;
    },
  });
}

// Unified shard hook that supports ALL, FLEX, and position shards
type ShardPos = "ALL" | "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX";

export function useShardAggregates(
  pos: ShardPos,
  opts?: { enabled?: boolean }
) {
  const enabled = opts?.enabled ?? true;
  return useQuery<CombinedEntryT[], Error>({
    queryKey: qk.aggregates.shard(pos),
    queryFn: async () => {
      const shard = await fetchShard(pos);
      return Object.values(shard);
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Legacy compatibility hooks - now using unified shard hook
export function useAllAggregates(opts?: { enabled?: boolean }) {
  return useShardAggregates("ALL", opts);
}

export function useFlexAggregates(opts?: { enabled?: boolean }) {
  return useShardAggregates("FLEX", opts);
}

// Convenience hooks for specific positions
export function useQBAggregates(opts?: { enabled?: boolean }) {
  return useShardAggregates("QB", opts);
}

export function useRBAggregates(opts?: { enabled?: boolean }) {
  return useShardAggregates("RB", opts);
}

export function useWRAggregates(opts?: { enabled?: boolean }) {
  return useShardAggregates("WR", opts);
}

export function useTEAggregates(opts?: { enabled?: boolean }) {
  return useShardAggregates("TE", opts);
}

export function useKAggregates(opts?: { enabled?: boolean }) {
  return useShardAggregates("K", opts);
}

export function useDEFAggregates(opts?: { enabled?: boolean }) {
  return useShardAggregates("DEF", opts);
}

export function useDraftDetails(
  draftId: string | undefined,
  opts?: { enabled?: boolean; refetchInterval?: number }
) {
  const enabled = Boolean(draftId) && (opts?.enabled ?? true);
  return useQuery<DraftDetails, Error>({
    queryKey: qk.draft.details(String(draftId)),
    queryFn: () => fetchDraftDetails(String(draftId)),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: opts?.refetchInterval ?? 3000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useDraftPicks(
  draftId: string | undefined,
  opts?: { enabled?: boolean; refetchInterval?: number }
) {
  const enabled = Boolean(draftId) && (opts?.enabled ?? true);
  return useQuery<DraftPick[], Error>({
    queryKey: qk.draft.picks(String(draftId)),
    queryFn: () => fetchDraftPicks(String(draftId)),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: opts?.refetchInterval ?? 3000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function usePlayersByScoringType(
  scoringType: ScoringType | undefined,
  opts?: { enabled?: boolean }
) {
  const enabled = Boolean(scoringType) && (opts?.enabled ?? true);
  return useQuery<Record<string, CombinedEntryT>, Error>({
    queryKey: qk.players.byScoring(String(scoringType)),
    queryFn: async () => {
      if (!scoringType) return {} as Record<string, CombinedEntryT>;
      const res = await fetch(
        `/api/players?scoring=${encodeURIComponent(scoringType)}`
      );
      if (!res.ok) throw new Error("failed to load players map");
      const json = await res.json();
      return CombinedShard.parse(json);
    },
    enabled,
    // Fetch on each page load; do not cache long-term
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

// Server-computed draft view-model using same helpers as client
export function useDraftViewModel(
  userId: string | undefined,
  draftId: string | undefined,
  opts?: { enabled?: boolean; refetchInterval?: number }
) {
  const enabled = Boolean(userId && draftId) && (opts?.enabled ?? true);
  return useQuery<Record<string, any>, Error>({
    queryKey: qk.draft.viewModel(String(draftId), String(userId)),
    queryFn: async () => {
      const params = new URLSearchParams({
        draft_id: String(draftId),
        user_id: String(userId),
      });
      const res = await fetch(`/api/draft/view-model?${params.toString()}`);
      if (!res.ok) throw new Error("failed to load draft view model");
      return (await res.json()) as Record<string, any>;
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: opts?.refetchInterval ?? 3000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

// Server-computed draft summary
export function useDraftSummary(
  userId: string | undefined,
  draftId: string | undefined,
  opts?: { enabled?: boolean; refetchInterval?: number }
) {
  const enabled = Boolean(userId && draftId) && (opts?.enabled ?? true);
  return useQuery<Record<string, any>, Error>({
    queryKey: qk.draft.summary(String(draftId), String(userId)),
    queryFn: async () => {
      const params = new URLSearchParams({
        draft_id: String(draftId),
        user_id: String(userId),
      });
      const res = await fetch(`/api/draft?${params.toString()}`);
      if (!res.ok) throw new Error("failed to load draft summary");
      return (await res.json()) as Record<string, any>;
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: opts?.refetchInterval ?? 3000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

// Legacy: load the ALL combined aggregate file for beer sheets computations

export function useSleeperPlayersMetaStatic(enabled: boolean) {
  return useQuery<SleeperPlayersMetaT, Error>({
    queryKey: qk.sleeper.playersMeta,
    queryFn: async () => {
      const res = await fetch("/data/sleeper/raw/players-meta-latest.json");
      if (!res.ok) throw new Error("failed to load players meta");
      const json = await res.json();
      return SleeperPlayersMeta.parse(json);
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

export function useAggregatesLastModified(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  return useQuery({
    queryKey: qk.aggregates.lastModified,
    queryFn: async (): Promise<AggregatesLastModifiedResponse> => {
      const res = await fetch("/api/aggregates/last-modified");
      if (!res.ok) {
        throw new Error("Failed to fetch aggregates last modified");
      }
      return res.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
