import type { DraftPick } from "./schemas";
import { DraftPickSchema, DraftPicksSchema } from "./schemas";

export async function fetchDraftPicks(draftId: string): Promise<DraftPick[]> {
  const url = new URL(
    `https://api.sleeper.app/v1/draft/${encodeURIComponent(draftId)}/picks`
  );
  url.searchParams.set("_", String(Date.now()));
  const response = await fetch(url.toString(), { cache: "no-store" });

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
  const parsedData = DraftPicksSchema.safeParse(jsonData);
  if (!parsedData.success) {
    console.warn(
      "fetchDraftPicks: non-standard picks payload, falling back to lenient parse"
    );
    try {
      // Lenient fallback: coerce minimal fields when draft is pre_draft or payload shape differs
      if (Array.isArray(jsonData)) {
        return jsonData.flatMap((p: unknown) => {
          if (!isRecord(p)) return [];
          const draft_slot = Number(
            p.draft_slot ?? p.draft_slot_no ?? p.slot
          );
          const round = Number(p.round ?? p.r);
          const pick_no = Number(p.pick_no ?? p.pick ?? p.p);
          const player_id = String(p.player_id ?? p.pid ?? "");
          if (
            !player_id ||
            !Number.isFinite(draft_slot) ||
            !Number.isFinite(round) ||
            !Number.isFinite(pick_no)
          ) {
            return [];
          }
          const parsedPick = DraftPickSchema.safeParse({
            draft_slot,
            round,
            pick_no,
            player_id,
          });
          return parsedPick.success ? [parsedPick.data] : [];
        });
      }
    } catch {}
    return [];
  }

  // Add normalized name and handle cases where first_name or last_name are missing
  return parsedData.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
