import { describe, expect, it } from "vitest";

import { buildDataHealthResponse } from "../../src/lib/dataHealth";
import type { DraftReadinessReport } from "../../src/lib/draftReadiness";

const CHECKED_AT = "2026-09-04T12:00:00.000Z";
const cohort = (id: "core" | "expected" | "reserve") => ({
  id,
  label: id,
  rankDepth: 120,
  requiredCoveragePct: id === "reserve" ? 95 : 100,
  playerIds: ["player-1"],
  total: 1,
  ready: 1,
  coveragePct: 100,
  status: "ready" as const,
});
const readiness = {
  version: 3,
  status: "ready",
  checkedAt: CHECKED_AT,
  mode: "draft",
  season: "2026",
  league: { teams: 12, rounds: 14, scoring: "ppr" },
  providers: {
    fantasyPros: {
      status: "ready",
      season: "2026",
      fetchedAt: CHECKED_AT,
      lastUpdatedAt: CHECKED_AT,
      fetchAgeHours: 0,
      providerAgeHours: 0,
      expertsIncluded: 100,
      expertsAvailable: 150,
      expertCoveragePct: 66.7,
    },
    sleeper: {
      status: "ready",
      season: "2026",
      fetchedAt: CHECKED_AT,
      lastUpdatedAt: CHECKED_AT,
      fetchAgeHours: 0,
      providerAgeHours: 0,
      expertsIncluded: null,
      expertsAvailable: null,
      expertCoveragePct: null,
    },
  },
  shards: { ALL: 1, QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DEF: 1, FLEX: 1 },
  cohorts: {
    core: cohort("core"),
    expected: cohort("expected"),
    reserve: cohort("reserve"),
  },
  playerIssues: [],
  incidents: [],
} satisfies DraftReadinessReport;

describe("deployment data health", () => {
  it("is healthy for the expected commit with current draft data", () => {
    const response = buildDataHealthResponse({
      commitSha: "abc1234",
      expectedCommitSha: "abc1234",
      readiness,
      now: new Date("2026-09-04T17:00:00.000Z"),
    });
    expect(response.status).toBe("healthy");
    expect(response.checks).toEqual({
      commitMatches: true,
      dataCurrent: true,
    });
  });

  it("becomes unhealthy for a stale report or wrong deployed commit", () => {
    const response = buildDataHealthResponse({
      commitSha: "old1234",
      expectedCommitSha: "new1234",
      readiness,
      now: new Date("2026-09-05T12:00:00.000Z"),
    });
    expect(response.status).toBe("unhealthy");
    expect(response.checks).toEqual({
      commitMatches: false,
      dataCurrent: false,
    });
  });

  it("becomes unhealthy when a provider ages after a recent assessment", () => {
    const response = buildDataHealthResponse({
      commitSha: "abc1234",
      expectedCommitSha: "abc1234",
      readiness: {
        ...readiness,
        checkedAt: "2026-09-05T11:30:00.000Z",
        providers: {
          ...readiness.providers,
          fantasyPros: {
            ...readiness.providers.fantasyPros,
            fetchedAt: "2026-09-04T16:00:00.000Z",
          },
        },
      },
      now: new Date("2026-09-05T12:00:00.000Z"),
    });

    expect(response.status).toBe("unhealthy");
    expect(response.checks.dataCurrent).toBe(false);
  });
});
