import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/aggregates/bundle/route";
import * as fs from "fs";
import * as path from "path";

// Mock fs and path modules
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("path", () => ({
  resolve: vi.fn(),
}));

vi.mock("@/lib/combinedAggregates", () => ({
  getAggregatesLastModifiedServer: vi.fn(),
}));

describe("/api/aggregates/bundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with valid bundle data for all shards", async () => {
    // Mock file system
    const mockResolve = vi.mocked(path.resolve);
    const mockExistsSync = vi.mocked(fs.existsSync);
    const mockReadFileSync = vi.mocked(fs.readFileSync);

    mockResolve.mockReturnValue("/mock/path");
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        player1: {
          player_id: "player1",
          name: "Test Player 1",
          position: "QB",
          team: "TB",
          bye_week: 11,
          borischen: {
            std: { rank: 1, tier: 1 },
            ppr: { rank: 1, tier: 1 },
            half: { rank: 1, tier: 1 },
          },
          sleeper: {
            stats: {
              adp_std: 1.5,
              adp_ppr: 1.5,
              adp_half_ppr: 1.5,
              pts_std: 450,
              pts_ppr: 450,
              pts_half_ppr: 450,
            },
            week: null,
            player: {
              injury_body_part: null,
              injury_notes: null,
              injury_start_date: null,
              injury_status: null,
            },
            updated_at: null,
          },
          fantasypros: {
            player_id: "player1",
            player_owned_avg: 95,
            pos_rank: "QB1",
            stats: {
              standard: { FPTS_AVG: 25.5 },
              ppr: { FPTS_AVG: 25.5 },
              half: { FPTS_AVG: 25.5 },
            },
            rankings: {
              standard: { rank_ecr: 1, tier: 1 },
              ppr: { rank_ecr: 1, tier: 1 },
              half: { rank_ecr: 1, tier: 1 },
            },
          },
        },
      })
    );

    // Mock last modified
    const { getAggregatesLastModifiedServer } = await import(
      "@/lib/combinedAggregates"
    );
    vi.mocked(getAggregatesLastModifiedServer).mockReturnValue(1234567890000);

    const url = new URL("http://localhost/api/aggregates/bundle");
    url.searchParams.set("scoring", "ppr");
    url.searchParams.set("teams", "12");
    url.searchParams.set("slots_qb", "1");
    url.searchParams.set("slots_rb", "2");
    url.searchParams.set("slots_wr", "2");
    url.searchParams.set("slots_te", "1");
    url.searchParams.set("slots_k", "1");
    url.searchParams.set("slots_def", "1");
    url.searchParams.set("slots_flex", "1");

    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty("lastModified", 1234567890000);
    expect(data).toHaveProperty("scoring", "ppr");
    expect(data).toHaveProperty("teams", 12);
    expect(data).toHaveProperty("roster");
    expect(data).toHaveProperty("shards");

    // Check that all expected shards are present
    expect(data.shards).toHaveProperty("QB");
    expect(data.shards).toHaveProperty("RB");
    expect(data.shards).toHaveProperty("WR");
    expect(data.shards).toHaveProperty("TE");
    expect(data.shards).toHaveProperty("K");
    expect(data.shards).toHaveProperty("DEF");
    expect(data.shards).toHaveProperty("FLEX");
    expect(data.shards).toHaveProperty("ALL");

    // Check response headers
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("returns 400 for invalid scoring parameter", async () => {
    const url = new URL("http://localhost/api/aggregates/bundle");
    url.searchParams.set("scoring", "invalid");
    url.searchParams.set("teams", "12");
    url.searchParams.set("slots_qb", "1");

    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  it("returns 400 for invalid teams parameter", async () => {
    const url = new URL("http://localhost/api/aggregates/bundle");
    url.searchParams.set("scoring", "ppr");
    url.searchParams.set("teams", "0"); // Invalid: must be > 0

    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  it("returns 500 when shard file is missing", async () => {
    const mockExistsSync = vi.mocked(fs.existsSync);
    mockExistsSync.mockReturnValue(false);

    const url = new URL("http://localhost/api/aggregates/bundle");
    url.searchParams.set("scoring", "ppr");
    url.searchParams.set("teams", "12");
    url.searchParams.set("slots_qb", "1");
    url.searchParams.set("slots_rb", "2");
    url.searchParams.set("slots_wr", "2");
    url.searchParams.set("slots_te", "1");
    url.searchParams.set("slots_k", "1");
    url.searchParams.set("slots_def", "1");
    url.searchParams.set("slots_flex", "1");

    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });
});
