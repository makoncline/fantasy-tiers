import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAggregatesBundle } from "@/lib/api/aggregatesBundle";
import { AggregatesBundleResponse } from "@/lib/schemas-bundle";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("fetchAggregatesBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches bundle data with correct parameters and validates response", async () => {
    const mockResponse = {
      lastModified: 1234567890000,
      scoring: "ppr",
      teams: 12,
      roster: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        K: 1,
        DEF: 1,
        FLEX: 1,
        BENCH: 0,
      },
      shards: {
        ALL: [
          {
            player_id: "player1",
            name: "Test Player",
            position: "QB",
            team: "TB",
            bye_week: 11,
            borischen: { rank: 1, tier: 1 },
            sleeper: { rank: 1, adp: 1.5, pts: 450 },
            fantasypros: {
              rank: 1,
              tier: 1,
              pos_rank: "QB1",
              ecr: 1,
              ecr_round_pick: "1.01",
              pts: 25.5,
              baseline_pts: 20.0,
              adp: null,
              player_owned_avg: 95,
            },
            calc: { value: 86, positional_scarcity: 62, market_delta: -1 },
          },
        ],
        QB: [],
        RB: [],
        WR: [],
        TE: [],
        K: [],
        DEF: [],
        FLEX: [],
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const params = {
      scoring: "ppr" as const,
      teams: 12,
      roster: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        K: 1,
        DEF: 1,
        FLEX: 1,
        BENCH: 0,
      },
    };

    const result = await fetchAggregatesBundle(params);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/aggregates/bundle?scoring=ppr&teams=12&slots_qb=1&slots_rb=2&slots_wr=2&slots_te=1&slots_k=1&slots_def=1&slots_flex=1"
    );

    expect(result).toEqual(mockResponse);
  });

  it("throws error on HTTP error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const params = {
      scoring: "ppr" as const,
      teams: 12,
      roster: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        K: 1,
        DEF: 1,
        FLEX: 1,
        BENCH: 0,
      },
    };

    await expect(fetchAggregatesBundle(params)).rejects.toThrow(
      "Failed to fetch aggregates bundle: 500 Internal Server Error"
    );
  });

  it("throws error on invalid JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });

    const params = {
      scoring: "ppr" as const,
      teams: 12,
      roster: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        K: 1,
        DEF: 1,
        FLEX: 1,
        BENCH: 0,
      },
    };

    await expect(fetchAggregatesBundle(params)).rejects.toThrow();
  });

  it("validates response schema and throws on invalid data", async () => {
    const invalidResponse = {
      lastModified: "invalid", // Should be number
      scoring: "ppr",
      teams: 12,
      roster: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        K: 1,
        DEF: 1,
        FLEX: 1,
        BENCH: 0,
      },
      shards: {
        ALL: [],
        QB: [],
        RB: [],
        WR: [],
        TE: [],
        K: [],
        DEF: [],
        FLEX: [],
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => invalidResponse,
    });

    const params = {
      scoring: "ppr" as const,
      teams: 12,
      roster: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        K: 1,
        DEF: 1,
        FLEX: 1,
        BENCH: 0,
      },
    };

    await expect(fetchAggregatesBundle(params)).rejects.toThrow();
  });
});
