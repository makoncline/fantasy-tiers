import { z } from "zod";
import type { DraftPick } from "./schemas";
import { DraftPickSchema } from "./schemas";

export async function fetchDraftPicks(draftId: string): Promise<DraftPick[]> {
  const response = await fetch(
    `https://api.sleeper.app/v1/draft/${draftId}/picks`
  );

  // In pre_draft states, Sleeper may return 404/empty; treat as no picks yet
  if (!response.ok) {
    if (response.status === 404 || response.status === 204) {
      return [];
    }
    try {
      const text = await response.text();
      if (text === "null" || text.trim() === "") {
        return [];
      }
    } catch {}
    throw new Error("Failed to fetch drafted players");
  }

  const jsonData = await response.json();

  // Handle the case where no picks have been made (API returns an empty array)
  if (Array.isArray(jsonData) && jsonData.length === 0) {
    return []; // Return an empty array if no picks have been made
  }

  // Validate the response using Zod
  const parsedData = z.array(DraftPickSchema).safeParse(jsonData);
  if (!parsedData.success) {
    console.warn(
      "fetchDraftPicks: non-standard picks payload, falling back to lenient parse"
    );
    try {
      // Lenient fallback: coerce minimal fields when draft is pre_draft or payload shape differs
      if (Array.isArray(jsonData)) {
        return jsonData
          .map((p: unknown) => {
            if (!p) return null;
            const pickData = p as Record<string, unknown>;
            const draft_slot = Number(
              pickData.draft_slot ?? pickData.draft_slot_no ?? pickData.slot
            );
            const round = Number(pickData.round ?? pickData.r);
            const pick_no = Number(
              pickData.pick_no ?? pickData.pick ?? pickData.p
            );
            const player_id = String(pickData.player_id ?? pickData.pid ?? "");
            if (
              !player_id ||
              !Number.isFinite(draft_slot) ||
              !Number.isFinite(round) ||
              !Number.isFinite(pick_no)
            ) {
              return null;
            }
            return { draft_slot, round, pick_no, player_id } as DraftPick;
          })
          .filter(Boolean) as DraftPick[];
      }
    } catch {}
    return [];
  }

  // Add normalized name and handle cases where first_name or last_name are missing
  return parsedData.data;
}
