import { useQuery } from "@tanstack/react-query";
import {
  fetchSleeperUserByUsername,
  fetchSleeperUserById,
  fetchDraftsForUserYear,
  fetchSleeperNflState,
  type SleeperUser,
  type SleeperDraftSummary,
  type SleeperNflState,
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

export function useSleeperNflState(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  return useQuery<SleeperNflState, Error>({
    queryKey: ["sleeper:state", "nfl"],
    queryFn: fetchSleeperNflState,
    enabled,
    staleTime: Infinity,
    gcTime: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}
