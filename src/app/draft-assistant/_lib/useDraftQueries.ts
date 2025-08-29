import { useQuery } from "@tanstack/react-query";
import { getPlayersByScoringTypeClient } from "@/lib/getPlayersClient";
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
        ? getPlayersByScoringTypeClient(scoringType)
        : Promise.resolve({}),
    enabled: !!scoringType,
  });
}
