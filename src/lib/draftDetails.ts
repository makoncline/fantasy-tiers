import { z } from "zod";

export const DraftSettingsSchema = z
  .object({
    teams: z.number().optional().default(0),
    rounds: z.number().optional().default(0),
    slots_qb: z.number().optional().default(0),
    slots_rb: z.number().optional().default(0),
    slots_wr: z.number().optional().default(0),
    slots_te: z.number().optional().default(0),
    slots_k: z.number().optional().default(0),
    slots_def: z.number().optional().default(0),
    slots_flex: z.number().optional().default(0),
  })
  .optional()
  .default({
    teams: 0,
    rounds: 0,
    slots_qb: 0,
    slots_rb: 0,
    slots_wr: 0,
    slots_te: 0,
    slots_k: 0,
    slots_def: 0,
    slots_flex: 0,
  });

export const DraftMetadataSchema = z
  .object({
    name: z.string().optional(),
    scoring_type: z.string().optional(),
  })
  .default({});

export const DraftDetailsSchema = z.object({
  draft_id: z.string(),
  type: z.string().optional(),
  season: z.string().optional(),
  start_time: z.number().nullable().optional(),
  status: z.string().optional(),
  metadata: DraftMetadataSchema,
  settings: DraftSettingsSchema,
  slot_to_roster_id: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional()
    .default({}),
  draft_order: z.record(z.string(), z.number()).default({}),
});

export type DraftDetails = z.infer<typeof DraftDetailsSchema>;

export async function fetchDraftDetails(
  draftId: string
): Promise<DraftDetails> {
  const res = await fetch(
    `https://api.sleeper.app/v1/draft/${encodeURIComponent(draftId)}`
  );
  if (!res.ok) {
    // Treat null/empty bodies as not-yet-created drafts
    if (res.status === 404 || res.status === 204) {
      throw new Error(`Draft not found or not initialized (${res.status})`);
    }
    try {
      const t = await res.text();
      if (t === "null" || t.trim() === "") {
        throw new Error("Draft not initialized");
      }
    } catch {}
    throw new Error(`Failed to fetch draft details: ${res.status}`);
  }
  const json = await res.json();
  return DraftDetailsSchema.parse(json);
}
