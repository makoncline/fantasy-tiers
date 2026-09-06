import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

import { GET } from "@/app/api/health/data/route";
import { DraftReadinessReportSchema } from "@/lib/draftReadiness";

describe("/api/health/data", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reassesses the deployed aggregate artifacts before reporting healthy", async () => {
    vi.useFakeTimers();
    const snapshot = DraftReadinessReportSchema.parse(JSON.parse(
      readFileSync("public/data/aggregate/quality-report.json", "utf8")
    ));
    vi.setSystemTime(new Date(snapshot.checkedAt));

    const response = await GET(
      new NextRequest("http://localhost/api/health/data")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.readiness.status).toBe("ready");
    expect(body.readiness.cohorts.core.coveragePct).toBe(100);
    expect(body.readiness.cohorts.expected.coveragePct).toBe(100);
  });
});
