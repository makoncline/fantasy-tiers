import { z } from "zod";
import { DraftPicksSchema } from "../../src/lib/schemas";

export const ProspectiveBoundarySchema = z.object({
  capturedAt: z.string().datetime(), confirmedAt: z.string().datetime(),
  picks: DraftPicksSchema,
  nextOwnPick: z.number().int().positive(),
  conditionedSelectionId: z.string(), defaultId: z.string().nullable(),
});
export function verifyProspectiveBoundary(
  boundary: z.infer<typeof ProspectiveBoundarySchema>,
  completed: z.infer<typeof DraftPicksSchema>,
) {
  const capture = ProspectiveBoundarySchema.parse(boundary);
  const ownPickNo = capture.picks.length + 1;
  if (capture.picks.some((p, i) => p.pick_no !== i + 1) ||
      capture.nextOwnPick <= ownPickNo ||
      Date.parse(capture.confirmedAt) < Date.parse(capture.capturedAt) ||
      JSON.stringify(completed.slice(0, capture.picks.length)) !== JSON.stringify(capture.picks) ||
      completed[ownPickNo - 1]?.player_id !== capture.conditionedSelectionId) {
    throw new Error("The prospective prefix or conditioned selection is invalid.");
  }
  // The forecast must condition on the actual pick. Following the default is unrelated.
  return { evidenceValid: true, ownerFollowedDefault: capture.defaultId == null ? null : capture.conditionedSelectionId === capture.defaultId };
}
