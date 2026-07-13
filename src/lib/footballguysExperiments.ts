import { z } from "zod";

export const FootballguysExperimentManifestSchema = z.object({
  experimentId: z.string().regex(/^[A-Za-z0-9._-]+$/),
  description: z.string().min(1),
  delayMs: z.number().int().min(15_000).default(30_000),
  cases: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9._-]+$/),
        hypothesis: z.string().min(1),
        requestPath: z.string().min(1),
        changedDimension: z.string().min(1),
      })
    )
    .min(1),
});

export type FootballguysExperimentManifest = z.infer<
  typeof FootballguysExperimentManifestSchema
>;
