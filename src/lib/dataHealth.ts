import { z } from "zod";

import {
  DraftReadinessReportSchema,
  isDraftReadinessReportCurrent,
  type DraftReadinessReport,
} from "@/lib/draftReadiness";

export const DataHealthResponseSchema = z.object({
  status: z.enum(["healthy", "unhealthy"]),
  commitSha: z.string().nullable(),
  expectedCommitSha: z.string().nullable(),
  checks: z.object({
    commitMatches: z.boolean(),
    dataCurrent: z.boolean(),
  }),
  readiness: DraftReadinessReportSchema,
});

export type DataHealthResponse = z.infer<typeof DataHealthResponseSchema>;

export function buildDataHealthResponse(input: {
  commitSha: string | null;
  expectedCommitSha: string | null;
  readiness: DraftReadinessReport;
  now?: Date;
}): DataHealthResponse {
  const commitMatches =
    input.expectedCommitSha === null ||
    input.commitSha === input.expectedCommitSha;
  const dataCurrent = isDraftReadinessReportCurrent(
    input.readiness,
    input.now ?? new Date()
  );
  return DataHealthResponseSchema.parse({
    status: commitMatches && dataCurrent ? "healthy" : "unhealthy",
    commitSha: input.commitSha,
    expectedCommitSha: input.expectedCommitSha,
    checks: { commitMatches, dataCurrent },
    readiness: input.readiness,
  });
}
