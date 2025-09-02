import { describe, it, expect } from "vitest";
import { buildPlayersMapFromCombined } from "../../src/lib/playersFromCombined";
import { CombinedEntryT } from "../../src/lib/schemas-aggregates";
import { ScoringType } from "../../src/lib/schemas";

describe("buildPlayersMapFromCombined", () => {
  const mockCombinedData: Record<string, CombinedEntryT> = {
    "12345": {
      player_id: "12345",
      name: "john doe",
      position: "QB",
      team: "TB",
      bye_week: 9,
      borischen: {
        std: { rank: 12, tier: 3 },
        ppr: { rank: 15, tier: 4 },
        half: { rank: 10, tier: 2 },
      },
      sleeper: {
        stats: {
          adp_std: 45.2,
          adp_ppr: 42.1,
          adp_half_ppr: 43.5,
          pts_std: 350.5,
          pts_ppr: 355.2,
          pts_half_ppr: 352.8,
        },
        week: null,
        player: {
          injury_body_part: null,
          injury_notes: null,
          injury_start_date: null,
          injury_status: null,
        },
        updated_at: 1640995200000,
      },
      fantasypros: {
        player_id: "12345",
        player_owned_avg: 15.5,
        pos_rank: "QB12",
        stats: {
          standard: { fpts: 350 },
          ppr: { fpts: 355 },
          half: { fpts: 352 },
        },
        rankings: {
          standard: { rank: 12 },
          ppr: { rank: 15 },
          half: { rank: 10 },
        },
      },
    },
    "67890": {
      player_id: "67890",
      name: "jane smith",
      position: "RB",
      team: "KC",
      bye_week: 12,
      borischen: {
        std: null,
        ppr: null,
        half: null,
      },
      sleeper: {
        stats: {},
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
    "99999": {
      player_id: "99999",
      name: "bob wilson",
      position: "RB", // Valid fantasy position
      team: "SF",
      bye_week: 11,
      borischen: {
        std: null,
        ppr: null,
        half: null,
      },
      sleeper: {
        stats: {},
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

  describe("standard scoring", () => {
    it("should build player map with correct data structure", () => {
      const result = buildPlayersMapFromCombined(mockCombinedData, "std");

      expect(result).toHaveProperty("12345");
      expect(result).toHaveProperty("67890");
      expect(result).toHaveProperty("99999"); // RB should be included

      const player = result["12345"];
      expect(player).toMatchObject({
        scoringType: "std",
        player_id: "12345",
        name: "john doe",
        position: "QB",
        team: "TB",
        bye_week: "9",
        rank: 12,
        tier: 3,
      });

      expect(player.borischen).toEqual({ rank: 12, tier: 3 });
      expect(player.sleeper.stats).toEqual({
        adp: 45.2,
        pts: 350.5,
      });
    });

    it("should handle null borischen rankings", () => {
      const result = buildPlayersMapFromCombined(mockCombinedData, "std");

      const player = result["67890"];
      expect(player.rank).toBeNull();
      expect(player.tier).toBeNull();
      expect(player.borischen).toBeNull();
    });

    it("should handle missing sleeper stats", () => {
      const result = buildPlayersMapFromCombined(mockCombinedData, "std");

      const player = result["67890"];
      expect(player.sleeper.stats).toEqual({
        adp: undefined,
        pts: undefined,
      });
    });
  });

  describe("ppr scoring", () => {
    it("should use PPR-specific data", () => {
      const result = buildPlayersMapFromCombined(mockCombinedData, "ppr");

      const player = result["12345"];
      expect(player.rank).toBe(15);
      expect(player.tier).toBe(4);
      expect(player.sleeper.stats).toEqual({
        adp: 42.1,
        pts: 355.2,
      });
    });
  });

  describe("half ppr scoring", () => {
    it("should use half PPR-specific data", () => {
      const result = buildPlayersMapFromCombined(mockCombinedData, "half");

      const player = result["12345"];
      expect(player.rank).toBe(10);
      expect(player.tier).toBe(2);
      expect(player.sleeper.stats).toEqual({
        adp: 43.5,
        pts: 352.8,
      });
    });
  });

  describe("fantasypros data", () => {
    it("should include fantasypros data when available", () => {
      const result = buildPlayersMapFromCombined(mockCombinedData, "std");

      const player = result["12345"];
      expect(player.fantasypros).toMatchObject({
        player_id: "12345",
        player_owned_avg: 15.5,
        pos_rank: "QB12",
        stats: {
          standard: { fpts: 350 },
          ppr: { fpts: 355 },
          half: { fpts: 352 },
        },
        rankings: {
          standard: { rank: 12 },
          ppr: { rank: 15 },
          half: { rank: 10 },
        },
      });
    });

    it("should handle null fantasypros data", () => {
      const result = buildPlayersMapFromCombined(mockCombinedData, "std");

      const player = result["67890"];
      expect(player.fantasypros).toBeNull();
    });
  });

  describe("position filtering", () => {
    it("should only include fantasy positions", () => {
      const result = buildPlayersMapFromCombined(mockCombinedData, "std");

      // Should include QB and RB
      expect(result).toHaveProperty("12345"); // QB
      expect(result).toHaveProperty("67890"); // RB
      expect(result).toHaveProperty("99999"); // RB
    });

    it("should normalize positions", () => {
      const dataWithWeirdPosition = {
        "11111": {
          ...mockCombinedData["12345"],
          player_id: "11111",
          position: "qb", // lowercase
        },
      };

      const result = buildPlayersMapFromCombined(dataWithWeirdPosition, "std");
      expect(result["11111"].position).toBe("QB");
    });
  });

  describe("data transformation", () => {
    it("should transform sleeper data correctly", () => {
      const result = buildPlayersMapFromCombined(mockCombinedData, "std");

      const player = result["12345"];
      expect(player.sleeper).toMatchObject({
        stats: { adp: 45.2, pts: 350.5 },
        week: null,
        player: {
          injury_body_part: null,
          injury_notes: null,
          injury_start_date: null,
          injury_status: null,
        },
        updated_at: 1640995200000,
      });
    });

    it("should handle numeric rank/tier conversion", () => {
      const dataWithStringRanks = {
        "11111": {
          ...mockCombinedData["12345"],
          borischen: {
            std: { rank: "12", tier: "3" }, // strings instead of numbers
            ppr: null,
            half: null,
          },
        },
      };

      const result = buildPlayersMapFromCombined(dataWithStringRanks, "std");
      const player = result["11111"];

      // Should handle string to number conversion
      expect(player.rank).toBe(12);
      expect(player.tier).toBe(3);
    });
  });
});
