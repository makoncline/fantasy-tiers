import { z } from "zod";
import {
  DraftDataQualityReportSchema,
  type DraftDataQualityReport,
} from "./draftDataQuality";

export const DataHealthResponseSchema = z.object({
  status: z.enum(["healthy", "unhealthy"]),
  commitSha: z.string().nullable(),
  expectedCommitSha: z.string().nullable(),
  checks: z.object({
    commitMatches: z.boolean(),
    dataCurrent: z.boolean(),
    historyConfigured: z.boolean(),
    historyQueryable: z.boolean(),
  }),
  quality: DraftDataQualityReportSchema,
});

export type DataHealthResponse = z.infer<typeof DataHealthResponseSchema>;

const MAX_REPORT_AGE_MS = 48 * 60 * 60 * 1_000;

export function buildDataHealthResponse(input: {
  commitSha: string | null;
  expectedCommitSha: string | null;
  quality: DraftDataQualityReport;
  historyConfigured: boolean;
  historyQueryable: boolean;
  now?: Date;
}): DataHealthResponse {
  const now = input.now ?? new Date();
  const reportAge = now.getTime() - new Date(input.quality.generatedAt).getTime();
  const commitMatches =
    input.expectedCommitSha === null ||
    input.commitSha === input.expectedCommitSha;
  const dataCurrent =
    input.quality.status === "healthy" &&
    reportAge >= 0 &&
    reportAge <= MAX_REPORT_AGE_MS;
  const healthy =
    commitMatches &&
    dataCurrent &&
    input.historyConfigured &&
    input.historyQueryable;

  return DataHealthResponseSchema.parse({
    status: healthy ? "healthy" : "unhealthy",
    commitSha: input.commitSha,
    expectedCommitSha: input.expectedCommitSha,
    checks: {
      commitMatches,
      dataCurrent,
      historyConfigured: input.historyConfigured,
      historyQueryable: input.historyQueryable,
    },
    quality: input.quality,
  });
}
