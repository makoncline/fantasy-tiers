import { useQuery } from "@tanstack/react-query";
import {
  getPlayersByScoringTypeClient,
  getCombinedPlayersByScoringTypeClient,
} from "@/lib/getPlayersClient";
import { fetchDraftDetails, DraftDetails } from "@/lib/draftDetails";
import { fetchDraftPicks } from "@/lib/draftPicks";
import { ScoringType, DraftPick, DraftedPlayer } from "@/lib/schemas";

export function useDraftDetails(draftId: string) {
  return useQuery<DraftDetails, Error>({
    queryKey: ["draft", draftId, "details"],
    queryFn: () => fetchDraftDetails(draftId),
    enabled: !!draftId,
  });
}

export function useDraftPicks(draftId: string) {
  return useQuery<DraftPick[], Error>({
    queryKey: ["draft", draftId, "picks"],
    queryFn: () => fetchDraftPicks(draftId),
    enabled: !!draftId,
  });
}

export function usePlayersByScoringType(scoringType: ScoringType | undefined) {
  return useQuery<Record<string, DraftedPlayer>, Error>({
    queryKey: ["players", scoringType],
    queryFn: () =>
      scoringType
        ? getCombinedPlayersByScoringTypeClient(scoringType)
        : Promise.resolve({}),
    enabled: !!scoringType,
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
  position: "ALL" | "QB" | "RB" | "WR" | "TE" | "FLEX",
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
