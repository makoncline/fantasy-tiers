import { z } from "zod";
import fetch from "node-fetch";
import { normalizePlayerName } from "@/lib/util"; // Updated import

// Zod schema for validating the drafted players from Sleeper API with only the necessary fields
const DraftedPlayerSchema = z.object({
  metadata: z.object({
    first_name: z.string(),
    last_name: z.string(),
    position: z.string(),
  }),
  player_id: z.string(),
  pick_no: z.number(),
  round: z.number(),
});

const DraftedPlayersSchema = z.array(DraftedPlayerSchema);

export async function fetchDraftedPlayers(draftId: string) {
  const response = await fetch(
    `https://api.sleeper.app/v1/draft/${draftId}/picks`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch drafted players");
  }

  const jsonData = await response.json();
  console.log(jsonData);

  // Validate the response using Zod
  const parsedData = DraftedPlayersSchema.safeParse(jsonData);
  if (!parsedData.success) {
    throw new Error("Invalid data structure from Sleeper API");
  }

  // Add normalized name to each player
  return parsedData.data.map((player) => ({
    pick_no: player.pick_no,
    position: player.metadata.position,
    normalized_name: normalizePlayerName(
      `${player.metadata.first_name} ${player.metadata.last_name}`
    ),
  }));
}
