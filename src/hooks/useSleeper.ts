import { useQuery } from "@tanstack/react-query";
import {
  fetchSleeperUserByUsername,
  fetchSleeperUserById,
  fetchLeaguesForUserYear,
  type SleeperUser,
  type SleeperLeague,
  fetchSleeperNflState,
  type SleeperNflState,
  fetchSleeperLeagueUsers,
  type SleeperLeagueUser,
} from "@/lib/sleeper";

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

export function useSleeperLeaguesForYear(
  userId: string | undefined,
  year: string,
  enabled: boolean
) {
  return useQuery<SleeperLeague[], Error>({
    queryKey: ["sleeper:leagues", userId, year],
    queryFn: async () => {
      if (!userId) throw new Error("userId is required");
      return fetchLeaguesForUserYear(userId, year);
    },
    enabled: Boolean(userId) && enabled,
    staleTime: 60 * 1000,
  });
}

// NFL state (season + week). Only fetch on initial load.
export function useSleeperNflState(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  return useQuery<SleeperNflState, Error>({
    queryKey: ["sleeper:state", "nfl"],
    queryFn: fetchSleeperNflState,
    enabled,
    staleTime: Infinity,
    gcTime: 6 * 60 * 60 * 1000, // keep around for 6h
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useSleeperLeagueUsers(
  leagueId: string | undefined,
  enabled: boolean
) {
  return useQuery<SleeperLeagueUser[], Error>({
    queryKey: ["sleeper:league:users", leagueId],
    queryFn: async () => {
      if (!leagueId) throw new Error("leagueId is required");
      return fetchSleeperLeagueUsers(leagueId);
    },
    enabled: Boolean(leagueId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
