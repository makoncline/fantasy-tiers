import { useQuery } from "@tanstack/react-query";
import {
  fetchSleeperUserByUsername,
  fetchSleeperUserById,
  fetchLeaguesForUserYear,
  type SleeperUser,
  type SleeperLeague,
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

