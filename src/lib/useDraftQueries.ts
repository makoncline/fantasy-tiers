import { useQuery } from "@tanstack/react-query";
import { getPlayersByScoringTypeClient } from "./getPlayersClient";
import { fetchDraftDetails, DraftDetails } from "./draftDetails";
import { fetchDraftPicks } from "./draftPicks";
import { ScoringType, DraftPick, DraftedPlayer } from "./schemas";

export function useDraftDetails(draftId: string) {
  return useQuery<DraftDetails, Error>({
    queryKey: ["draftDetails", draftId],
    queryFn: () => fetchDraftDetails(draftId),
    enabled: !!draftId,
  });
}

export function useDraftPicks(draftId: string) {
  return useQuery<DraftPick[], Error>({
    queryKey: ["draftPicks", draftId],
    queryFn: () => fetchDraftPicks(draftId),
    enabled: !!draftId,
  });
}

export function usePlayersByScoringType(scoringType: ScoringType | undefined) {
  return useQuery<Record<string, DraftedPlayer>, Error>({
    queryKey: ["playersByScoringType", scoringType],
    queryFn: () =>
      scoringType
        ? getPlayersByScoringTypeClient(scoringType)
        : Promise.resolve({}),
    enabled: !!scoringType,
  });
}
