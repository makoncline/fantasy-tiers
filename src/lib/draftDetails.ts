import { z } from "zod";
import { scoringTypeSchema } from "./schemas";

// Zod schema to validate the draft details
const DraftDetailsSchema = z.object({
  draft_id: z.string(),
  draft_order: z.record(z.string(), z.number()).nullable(), // Updated to allow null
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
    slots_wr: z.number().optional().default(0),
    slots_rb: z.number().optional().default(0),
    slots_qb: z.number().optional().default(0),
    slots_te: z.number().optional().default(0),
    slots_k: z.number().optional().default(0),
    slots_def: z.number().optional().default(0),
    slots_flex: z.number().optional().default(0),
    pick_timer: z.number(),
  }),
  metadata: z.object({
    description: z.string().nullable(),
    name: z.string().nullable(),
    scoring_type: scoringTypeSchema,
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

  // Explicitly type jsonData as 'any' to allow dynamic adjustments
  const jsonData: any = await response.json();

  // Handle the case where draft_order is null
  if (!jsonData.draft_order) {
    jsonData.draft_order = {};
  }

  if (jsonData.metadata && jsonData.metadata.scoring_type === "half_ppr") {
    jsonData.metadata.scoring_type = "half";
  }

  // Validate the response using Zod
  const parsedData = DraftDetailsSchema.safeParse(jsonData);
  if (!parsedData.success) {
    console.error(parsedData.error.errors);
    throw new Error(
      "fetchDraftDetails: Invalid data structure from Sleeper API"
    );
  }

  return parsedData.data;
}
