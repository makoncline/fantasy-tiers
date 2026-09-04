import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/health/data/route";

describe("/api/health/data", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reassesses the deployed aggregate artifacts before reporting healthy", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T17:45:00.000Z"));

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
