import { z } from "zod";
import fetch from "node-fetch";
import { normalizePlayerName } from "@/lib/util";
import fs from "fs";
import path from "path";

export const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
export const PositionEnum = z.enum(POSITIONS);
export type Position = z.infer<typeof PositionEnum>;

const ROSTER_SLOTS = [...POSITIONS, "FLEX"] as const;
export const RosterSlotEnum = z.enum(ROSTER_SLOTS);
export type RosterSlot = z.infer<typeof RosterSlotEnum>;

export const DraftPickSchema = z.object({
  draft_slot: z.number(),
  round: z.number(),
  pick_no: z.number(),
  player_id: z.string(),
  // draft_id: z.string(),
  // metadata: z.object({
  //   first_name: z.string(),
  //   last_name: z.string(),
  //   position: PositionEnum,
  //   team: z.string().nullable(),
  // }),
  // normalized_name: z.string().optional(), // We add this manually later, so it’s optional
  // bye_week: z.string().optional(),
});

export type DraftPick = z.infer<typeof DraftPickSchema>;

export async function fetchDraftPicks(draftId: string): Promise<DraftPick[]> {
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
  const parsedData = z.array(DraftPickSchema).safeParse(jsonData);
  if (!parsedData.success) {
    console.error("Zod Validation Errors:", parsedData.error); // Log the validation errors
    throw new Error("fetchDraftPicks: Invalid data structure from Sleeper API");
  }

  // Add normalized name and handle cases where first_name or last_name are missing
  return parsedData.data;
}
