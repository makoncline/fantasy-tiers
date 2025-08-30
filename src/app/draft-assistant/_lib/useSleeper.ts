import { useQuery } from "@tanstack/react-query";
import {
  fetchSleeperUserByUsername,
  fetchSleeperUserById,
  fetchDraftsForUserYear,
  type SleeperUser,
  type SleeperDraftSummary,
} from "@/lib/sleeper";
import type { SleeperProjection } from "@/lib/sleeper";

export function useSleeperUserByUsername(
  username: string | undefined,
  enabled: boolean
) {
  return useQuery<SleeperUser, Error>({
    queryKey: ["sleeper:user:username", username],
    queryFn: async () => {
      if (!username) throw new Error("username is required");
      return fetchSleeperUserByUsername(username);
    },
    enabled: Boolean(username) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSleeperUserById(
  userId: string | undefined,
  enabled: boolean
) {
  return useQuery<SleeperUser, Error>({
    queryKey: ["sleeper:user:id", userId],
    queryFn: async () => {
      if (!userId) throw new Error("userId is required");
      return fetchSleeperUserById(userId);
    },
    enabled: Boolean(userId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSleeperDrafts(
  userId: string | undefined,
  year: string,
  enabled: boolean
) {
  return useQuery<SleeperDraftSummary[], Error>({
    queryKey: ["sleeper:drafts", userId, year],
    queryFn: async () => {
      if (!userId) throw new Error("userId is required");
      return fetchDraftsForUserYear(userId, year);
    },
    enabled: Boolean(userId) && enabled,
    staleTime: 60 * 1000,
  });
}

export function useSleeperProjections(
  season: string | undefined,
  opts?: {
    seasonType?: string;
    positions?: string[];
    orderBy?: string;
    week?: number | string;
    sport?: string;
    enabled?: boolean;
  }
) {
  const enabled = (opts?.enabled ?? true) && Boolean(season);
  const seasonType = opts?.seasonType ?? "regular";
  const positions = opts?.positions ?? ["DEF", "K", "QB", "RB", "TE", "WR"];
  const orderBy = opts?.orderBy ?? "adp_half_ppr";
  const week = opts?.week;
  const sport = opts?.sport ?? "nfl";
  return useQuery<SleeperProjection[], Error>({
    queryKey: [
      "sleeper:projections",
      season,
      seasonType,
      positions.join(","),
      orderBy,
      week,
      sport,
    ],
    queryFn: async () => {
      if (!season) throw new Error("season is required");
      const params = new URLSearchParams();
      params.set("season", season);
      if (seasonType) params.set("season_type", seasonType);
      positions.forEach((p) => params.append("position[]", p));
      if (orderBy) params.set("order_by", orderBy);
      if (week != null) params.set("week", String(week));
      const res = await fetch(`/api/sleeper/projections?${params.toString()}`);
      if (!res.ok) throw new Error("failed to load projections");
      return (await res.json()) as SleeperProjection[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSleeperPlayersMeta(enabled: boolean = true) {
  return useQuery<Record<string, any>, Error>({
    queryKey: ["sleeper:players:meta"],
    queryFn: async () => {
      const res = await fetch("/api/sleeper/players");
      if (!res.ok) throw new Error("failed to load players meta");
      return (await res.json()) as Record<string, any>;
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}
