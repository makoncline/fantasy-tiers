import { z } from "zod";
import fetch from "node-fetch";
import { normalizePlayerName } from "@/lib/util";
import fs from "fs";
import path from "path";

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
export const PositionEnum = z.enum(POSITIONS);
export type Position = z.infer<typeof PositionEnum>;

const ROSTER_SLOTS = [...POSITIONS, "FLEX"] as const;
export const RosterSlotEnum = z.enum(ROSTER_SLOTS);
export type RosterSlot = z.infer<typeof RosterSlotEnum>;

export const DraftedPlayerSchema = z.object({
  draft_id: z.string(),
  draft_slot: z.number(),
  round: z.number(),
  metadata: z.object({
    first_name: z.string(),
    last_name: z.string(),
    position: PositionEnum,
    team: z.string().nullable(),
  }),
  pick_no: z.number(),
  player_id: z.string(),
  normalized_name: z.string().optional(), // We add this manually later, so it’s optional
  bye_week: z.string().optional(),
});

export type DraftedPlayer = z.infer<typeof DraftedPlayerSchema>;

export const DraftedPlayersSchema = z.array(DraftedPlayerSchema);

function loadTeamData() {
  const filePath = path.resolve(
    process.cwd(),
    "public",
    "data",
    "nfl-teams.json"
  );
  const rawData = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(rawData) as Record<
    string,
    { metadata: { bye_week: string } }
  >;
}

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

  // Handle the case where no picks have been made (API returns an empty array)
  if (Array.isArray(jsonData) && jsonData.length === 0) {
    return []; // Return an empty array if no picks have been made
  }

  // Validate the response using Zod
  const parsedData = DraftedPlayersSchema.safeParse(jsonData);
  if (!parsedData.success) {
    console.error("Zod Validation Errors:", parsedData.error); // Log the validation errors
    throw new Error(
      "fetchDraftedPlayers: Invalid data structure from Sleeper API"
    );
  }

  const teamData = loadTeamData();
  // Add normalized name and handle cases where first_name or last_name are missing
  return parsedData.data.map((player) => {
    const normalizedName = normalizePlayerName(
      `${player.metadata.first_name ?? ""} ${
        player.metadata.last_name ?? ""
      }`.trim()
    );

    const byeWeek = player.metadata.team
      ? parseInt(teamData[player.metadata.team]?.metadata.bye_week ?? "0", 10)
      : undefined; // Get the bye week if available

    return {
      ...player,
      normalized_name: normalizedName,
      bye_week: byeWeek?.toString(),
    };
  });
}
