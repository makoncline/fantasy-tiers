import { z } from "zod";
import fetch from "node-fetch";
import { normalizePlayerName } from "@/lib/util"; // Updated import

export const DraftedPlayerSchema = z.object({
  draft_id: z.string(),
  draft_slot: z.number(),
  round: z.number(),
  metadata: z.object({
    first_name: z.string().optional(), // Mark as optional since it may be missing
    last_name: z.string().optional(), // Mark as optional since it may be missing
    position: z.string().optional(), // Mark as optional since it may be missing
  }),
  pick_no: z.number(),
  player_id: z.string(),
  normalized_name: z.string().optional(), // We add this manually later, so it’s optional
});

export type DraftedPlayer = z.infer<typeof DraftedPlayerSchema>;

export const DraftedPlayersSchema = z.array(DraftedPlayerSchema);
export async function fetchDraftedPlayers(
  draftId: string
): Promise<DraftedPlayer[]> {
  const response = await fetch(
    `https://api.sleeper.app/v1/draft/${draftId}/picks`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch drafted players");
  }

  const jsonData = await response.json();

  // Validate the response using Zod
  const parsedData = DraftedPlayersSchema.safeParse(jsonData);
  if (!parsedData.success) {
    console.error("Zod Validation Errors:", parsedData.error); // Log the validation errors
    throw new Error("Invalid data structure from Sleeper API");
  }

  // Add normalized name and handle cases where first_name or last_name are missing
  return parsedData.data.map((player) => ({
    ...player,
    normalized_name: normalizePlayerName(
      `${player.metadata.first_name ?? ""} ${
        player.metadata.last_name ?? ""
      }`.trim() // Handle missing names
    ),
  }));
}
