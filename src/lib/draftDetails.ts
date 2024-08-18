import { z } from "zod";
import fetch from "node-fetch";

// Zod schema to validate the draft details
const DraftDetailsSchema = z.object({
  draft_id: z.string(),
  draft_order: z.record(z.string(), z.number()), // Mapping of user_id to draft slot
  slot_to_roster_id: z.record(z.string(), z.number()), // Mapping of draft slot to roster_id
  status: z.string(),
  type: z.string(),
  season: z.string(),
  season_type: z.string(),
  sport: z.string(),
  start_time: z.number().nullable(),
  settings: z.object({
    teams: z.number(),
    rounds: z.number(),
    slots_wr: z.number(),
    slots_rb: z.number(),
    slots_qb: z.number(),
    slots_te: z.number(),
    slots_k: z.number(),
    slots_def: z.number(),
    slots_flex: z.number(),
    pick_timer: z.number(),
  }),
  metadata: z.object({
    description: z.string().nullable(),
    name: z.string().nullable(),
    scoring_type: z.string().nullable(),
  }),
  created: z.number(),
  last_message_id: z.string().nullable(),
  last_message_time: z.number().nullable(),
  last_picked: z.number().nullable(),
  league_id: z.string().nullable(),
});

export type DraftDetails = z.infer<typeof DraftDetailsSchema>;

// Function to fetch and parse draft details
export async function fetchDraftDetails(draftId: string) {
  const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch draft details");
  }

  const jsonData = await response.json();

  // Validate the response using Zod
  const parsedData = DraftDetailsSchema.safeParse(jsonData);
  if (!parsedData.success) {
    console.error(parsedData.error); // Log the error details for debugging
    throw new Error("Invalid data structure from Sleeper API");
  }

  return parsedData.data;
}
