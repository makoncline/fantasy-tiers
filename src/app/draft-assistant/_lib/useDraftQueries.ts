import { useQuery } from "@tanstack/react-query";
// client aggregate helpers no longer used in draft assistant flow
import { fetchDraftDetails, DraftDetails } from "@/lib/draftDetails";
import { fetchDraftPicks } from "@/lib/draftPicks";
import { ScoringType, DraftPick, DraftedPlayer } from "@/lib/schemas";

export function useDraftDetails(
  draftId: string | undefined,
  opts?: { enabled?: boolean; refetchInterval?: number }
) {
  const enabled = Boolean(draftId) && (opts?.enabled ?? true);
  return useQuery<DraftDetails, Error>({
    queryKey: ["draft", draftId, "details"],
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
    queryKey: ["draft", draftId, "picks"],
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
  return useQuery<Record<string, DraftedPlayer>, Error>({
    queryKey: ["players", scoringType],
    queryFn: async () => {
      if (!scoringType) return {} as Record<string, DraftedPlayer>;
      const res = await fetch(`/api/players?scoring=${encodeURIComponent(scoringType)}`);
      if (!res.ok) throw new Error("failed to load players map");
      return (await res.json()) as Record<string, DraftedPlayer>;
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
    queryKey: ["draft", draftId, "view-model", userId],
    queryFn: async () => {
      const params = new URLSearchParams({ draft_id: String(draftId), user_id: String(userId) });
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
    queryKey: ["draft", draftId, "summary", userId],
    queryFn: async () => {
      const params = new URLSearchParams({ draft_id: String(draftId), user_id: String(userId) });
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

// New: load the ALL combined aggregate file for beer sheets computations
export function useCombinedAggregateAll(enabled: boolean) {
  return useQuery<Record<string, any>, Error>({
    queryKey: ["aggregates", "ALL"],
    queryFn: async () => {
      const res = await fetch("/data/aggregates/ALL-combined-aggregate.json");
      if (!res.ok) throw new Error("failed to load combined aggregates");
      return (await res.json()) as Record<string, any>;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// New: load static players meta snapshot from sleeper
export function useSleeperPlayersMetaStatic(enabled: boolean) {
  return useQuery<Record<string, any>, Error>({
    queryKey: ["sleeper", "players-meta", "static"],
    queryFn: async () => {
      const res = await fetch("/data/sleeper/raw/players-meta-latest.json");
      if (!res.ok) throw new Error("failed to load players meta");
      return (await res.json()) as Record<string, any>;
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

// New: load per-position combined aggregate shard
export function useCombinedAggregate(
  position: "ALL" | "QB" | "RB" | "WR" | "TE" | "FLEX" | "DEF" | "K",
  enabled: boolean
) {
  return useQuery<Record<string, any>, Error>({
    queryKey: ["aggregates", position],
    queryFn: async () => {
      const res = await fetch(`/data/aggregates/${position}-combined-aggregate.json`);
      if (!res.ok)
        throw new Error(`failed to load combined aggregates for ${position}`);
      return (await res.json()) as Record<string, any>;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
