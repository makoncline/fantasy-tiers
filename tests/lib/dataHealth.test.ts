import { describe, expect, it } from "vitest";
import { buildDataHealthResponse } from "../../src/lib/dataHealth";
import type { DraftDataQualityReport } from "../../src/lib/draftDataQuality";

const GENERATED_AT = "2026-07-13T16:00:00.000Z";
const quality = {
  version: 1,
  mode: "draft",
  season: "2026",
  generatedAt: GENERATED_AT,
  status: "healthy",
  shards: { ALL: 1, QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DEF: 1, FLEX: 1 },
  scoring: {
    std: {
      ecrRows: 300,
      topCandidates: 180,
      sleeperAdpCovered: 170,
      sleeperAdpCoveragePct: 94.4,
      tierCovered: 180,
      tierCoveragePct: 100,
      expertsIncluded: 60,
      expertsAvailable: 90,
      expertCoveragePct: 66.7,
    },
    half: {
      ecrRows: 300,
      topCandidates: 180,
      sleeperAdpCovered: 170,
      sleeperAdpCoveragePct: 94.4,
      tierCovered: 180,
      tierCoveragePct: 100,
      expertsIncluded: 60,
      expertsAvailable: 90,
      expertCoveragePct: 66.7,
    },
    ppr: {
      ecrRows: 300,
      topCandidates: 180,
      sleeperAdpCovered: 170,
      sleeperAdpCoveragePct: 94.4,
      tierCovered: 180,
      tierCoveragePct: 100,
      expertsIncluded: 60,
      expertsAvailable: 90,
      expertCoveragePct: 66.7,
    },
  },
  sources: {
    fantasyprosUpdatedAt: GENERATED_AT,
    sleeperUpdatedAt: GENERATED_AT,
    tiersUpdatedAt: GENERATED_AT,
  },
  warnings: [],
  errors: [],
} satisfies DraftDataQualityReport;

describe("deployment data health", () => {
  it("is healthy only for the expected current commit and queryable history", () => {
    const response = buildDataHealthResponse({
      commitSha: "abc1234",
      expectedCommitSha: "abc1234",
      quality,
      historyConfigured: true,
      historyQueryable: true,
      now: new Date("2026-07-14T16:00:00.000Z"),
    });
    expect(response.status).toBe("healthy");
    expect(response.checks).toEqual({
      commitMatches: true,
      dataCurrent: true,
      historyConfigured: true,
      historyQueryable: true,
    });
  });

  it("becomes unhealthy for a stale report or wrong deployed commit", () => {
    const response = buildDataHealthResponse({
      commitSha: "old1234",
      expectedCommitSha: "new1234",
      quality,
      historyConfigured: true,
      historyQueryable: true,
      now: new Date("2026-07-20T16:00:00.000Z"),
    });
    expect(response.status).toBe("unhealthy");
    expect(response.checks).toMatchObject({
      commitMatches: false,
      dataCurrent: false,
    });
  });
});
