import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDraftDetails } from "@/lib/draftDetails";
import type { DraftDetails } from "@/lib/draftDetails";
import { fetchDraftPicks } from "@/lib/draftPicks";
import type { ScoringType, DraftPick } from "@/lib/schemas";
import { qk } from "@/lib/queryKeys";

type AggregatesLastModifiedResponse = {
  timestamp: number | null;
  formatted: string | null;
};

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

// New bundle hook that fetches all shards at once
export function useAggregatesBundle(
  league: {
    teams: number;
    scoring: ScoringType;
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
  } | null,
  opts?: { enabled?: boolean }
) {
  const enabled = Boolean(league) && (opts?.enabled ?? true);

  React.useEffect(() => {
    // Debug effect - no-op
  }, [league, enabled]);

  return useQuery({
    queryKey: league
      ? qk.aggregates.bundle(league.scoring, league.teams, {
          QB: league.roster.QB,
          RB: league.roster.RB,
          WR: league.roster.WR,
          TE: league.roster.TE,
          K: league.roster.K,
          DEF: league.roster.DEF,
          FLEX: league.roster.FLEX,
        })
      : ["aggregates", "bundle"],
    queryFn: async () => {
      if (!league) throw new Error("League configuration required");
      const { fetchAggregatesBundle } = await import(
        "@/lib/api/aggregatesBundle"
      );
      const result = await fetchAggregatesBundle({
        scoring: league.scoring,
        teams: league.teams,
        roster: league.roster,
      });
      return result;
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });
}
