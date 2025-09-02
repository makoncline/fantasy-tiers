import { describe, it, expect, vi } from "vitest";

describe("/api/aggregates/last-modified", () => {
  it("endpoint exists and can be called", async () => {
    // Simple test to verify the endpoint exists and can be imported
    // The actual functionality is tested through the client hook tests
    const mockGetAggregatesLastModifiedServer = vi
      .fn()
      .mockReturnValue(Date.now());

    vi.doMock("../../src/lib/combinedAggregates", () => ({
      getAggregatesLastModifiedServer: mockGetAggregatesLastModifiedServer,
    }));

    // Dynamically import to avoid static import issues
    const { GET } = await import(
      "../../src/app/api/aggregates/last-modified/route"
    );

    const response = await GET();
    expect(response).toBeDefined();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toHaveProperty("timestamp");
    expect(json).toHaveProperty("formatted");
  });
});
