// tests/lib/api-aggregates.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchMergedAggregates,
  fetchShard,
} from "../../src/lib/api/aggregates";
import { CombinedShard } from "../../src/lib/schemas-aggregates";

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("API Aggregates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchMergedAggregates", () => {
    it("should fetch and parse merged aggregates successfully", async () => {
      const mockData = {
        "12345": {
          player_id: "12345",
          name: "John Doe",
          position: "QB",
          team: "TB",
          bye_week: 9,
          borischen: {
            std: { rank: 12, tier: 3 },
            ppr: null,
            half: { rank: 15, tier: 4 },
          },
          sleeper: {
            stats: {
              adp_std: 45.2,
              adp_half_ppr: 44.1,
              adp_ppr: 43.5,
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
          fantasypros: null,
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await fetchMergedAggregates();

      expect(fetchMock).toHaveBeenCalledWith("/api/players", {
        cache: "no-store",
      });
      expect(result).toEqual(mockData);
      expect(result["12345"].player_id).toBe("12345");
    });

    it("should throw error on fetch failure", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      await expect(fetchMergedAggregates()).rejects.toThrow(
        "Failed to fetch merged aggregates"
      );
    });

    it("should throw error on invalid response data", async () => {
      const invalidData = {
        "12345": {
          // Missing required fields
          player_id: "12345",
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(invalidData),
      });

      await expect(fetchMergedAggregates()).rejects.toThrow();
    });
  });

  describe("fetchShard", () => {
    it("should fetch and parse position shard successfully", async () => {
      const mockData = {
        "12345": {
          player_id: "12345",
          name: "John Doe",
          position: "QB",
          team: "TB",
          bye_week: 9,
          borischen: {
            std: { rank: 12, tier: 3 },
            ppr: null,
            half: { rank: 15, tier: 4 },
          },
          sleeper: {
            stats: {
              adp_std: 45.2,
              adp_half_ppr: 44.1,
              adp_ppr: 43.5,
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
          fantasypros: null,
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await fetchShard("QB");

      expect(fetchMock).toHaveBeenCalledWith("/api/aggregates/shard?pos=QB");
      expect(result).toEqual(mockData);
      expect(result["12345"].position).toBe("QB");
    });

    it("should throw error on fetch failure", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      });

      await expect(fetchShard("QB")).rejects.toThrow(
        "Failed to fetch QB shard"
      );
    });

    it.each(["ALL", "QB", "RB", "WR", "TE", "K", "DEF", "FLEX"])(
      "should work for position %s",
      async (position) => {
        const mockData = {
          "12345": {
            player_id: "12345",
            name: "John Doe",
            position:
              position === "ALL" ? "QB" : position === "FLEX" ? "RB" : position,
            team: "TB",
            bye_week: 9,
            borischen: { std: null, ppr: null, half: null },
            sleeper: {
              stats: {
                adp_std: 45.2,
                adp_half_ppr: 44.1,
                adp_ppr: 43.5,
                pts_std: 320.5,
                pts_half_ppr: 340.2,
                pts_ppr: 350.8,
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
            fantasypros: null,
          },
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        });

        const result = await fetchShard(position as any);
        expect(result).toBeDefined();
        expect(fetchMock).toHaveBeenCalledWith(
          `/api/aggregates/shard?pos=${position}`
        );
      }
    );
  });
});
