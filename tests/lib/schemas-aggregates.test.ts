import { describe, it, expect } from "vitest";
import {
  RankTier,
  RankTiersByScoring,
  SleeperStatsSubset,
  SleeperCombined,
  FantasyProsCombined,
  CombinedEntry,
  CombinedShard,
} from "../../src/lib/schemas-aggregates";

describe("Aggregate Schemas", () => {
  describe("RankTier", () => {
    it("should parse valid rank and tier", () => {
      const valid = { rank: 1, tier: 2 };
      expect(RankTier.parse(valid)).toEqual(valid);
    });

    it("should reject missing fields", () => {
      expect(() => RankTier.parse({ rank: 1 })).toThrow();
      expect(() => RankTier.parse({ tier: 2 })).toThrow();
    });

    it("should reject non-numbers", () => {
      expect(() => RankTier.parse({ rank: "1", tier: 2 })).toThrow();
      expect(() => RankTier.parse({ rank: 1, tier: "2" })).toThrow();
    });
  });

  describe("RankTiersByScoring", () => {
    it("should parse valid scoring tiers", () => {
      const valid = {
        std: { rank: 1, tier: 2 },
        ppr: null,
        half: { rank: 3, tier: 4 },
      };
      expect(RankTiersByScoring.parse(valid)).toEqual(valid);
    });

    it("should reject extra fields", () => {
      const invalid = {
        std: { rank: 1, tier: 2 },
        ppr: null,
        half: { rank: 3, tier: 4 },
        extra: "field",
      };
      expect(() => RankTiersByScoring.parse(invalid)).toThrow();
    });
  });

  describe("SleeperStatsSubset", () => {
    it("should parse valid stats with optional fields", () => {
      const valid = {
        adp_std: 12.5,
        adp_half_ppr: 11.2,
        adp_ppr: 10.8,
        pts_half_ppr: 150.5,
      };
      expect(SleeperStatsSubset.parse(valid)).toEqual(valid);
    });

    it("should reject extra fields", () => {
      const invalid = {
        adp_std: 12.5,
        extra_field: "not allowed",
      };
      expect(() => SleeperStatsSubset.parse(invalid)).toThrow();
    });
  });

  describe("SleeperCombined", () => {
    it("should parse valid sleeper data", () => {
      const valid = {
        stats: {
          adp_std: 12.5,
          adp_half_ppr: 11.2,
          adp_ppr: 10.8,
        },
        week: 5,
        player: {
          injury_body_part: "knee",
          injury_notes: "ACL tear",
          injury_start_date: "2024-01-01",
          injury_status: "Out",
        },
        updated_at: 1640995200000,
      };
      expect(SleeperCombined.parse(valid)).toEqual(valid);
    });

    it("should handle null values", () => {
      const input = {
        stats: {
          adp_std: 12.5,
          adp_half_ppr: 11.2,
          adp_ppr: 10.8,
        },
        week: null,
        player: {
          injury_body_part: null,
          injury_notes: null,
          injury_start_date: null,
          injury_status: null,
        },
        updated_at: null,
      };
      const result = SleeperCombined.parse(input);
      // Null values should remain null (not coerced to 0)
      expect(result.week).toBeNull();
      expect(result.updated_at).toBeNull();
    });

    it("should reject string values for numeric fields", () => {
      const invalid = {
        stats: {
          adp_std: 12.5,
          adp_half_ppr: 11.2,
          adp_ppr: 10.8,
        },
        week: "5", // Should be number or null
        player: {
          injury_body_part: null,
          injury_notes: null,
          injury_start_date: null,
          injury_status: null,
        },
        updated_at: 1640995200000,
      };
      expect(() => SleeperCombined.parse(invalid)).toThrow();
    });
  });

  describe("FantasyProsCombined", () => {
    it("should parse valid fantasypros data", () => {
      const valid = {
        player_id: "12345",
        player_owned_avg: 15.5,
        pos_rank: "RB12",
        stats: {
          standard: { fpts: 100 },
          ppr: { fpts: 100 },
          half: { fpts: 100 },
        },
        rankings: { standard: { rank: 12 } },
      };
      expect(FantasyProsCombined.parse(valid)).toEqual(valid);
    });

    it("should handle pos_rank as string or number", () => {
      const withString = {
        player_id: "12345",
        player_owned_avg: 15.5,
        pos_rank: "RB12",
        stats: {
          standard: {},
          ppr: {},
          half: {},
        },
        rankings: {},
      };
      const withNumber = {
        player_id: "12345",
        player_owned_avg: 15.5,
        pos_rank: 12,
        stats: {
          standard: {},
          ppr: {},
          half: {},
        },
        rankings: {},
      };
      expect(FantasyProsCombined.parse(withString)).toBeDefined();
      expect(FantasyProsCombined.parse(withNumber)).toBeDefined();
    });

    it("should handle null values for other fields", () => {
      const input = {
        player_id: "12345",
        player_owned_avg: null,
        pos_rank: null,
        stats: {
          standard: {},
          ppr: {},
          half: {},
        },
        rankings: {},
      };
      const result = FantasyProsCombined.parse(input);
      // player_id should be coerced to string
      expect(result.player_id).toBe("12345");
      expect(result.player_owned_avg).toBeNull();
      expect(result.pos_rank).toBeNull();
    });
  });

  describe("CombinedEntry", () => {
    it("should parse a complete valid entry", () => {
      const input = {
        player_id: "12345",
        name: "john doe",
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
          updated_at: 1640995200000,
        },
        fantasypros: {
          player_id: "12345",
          player_owned_avg: 15.5,
          pos_rank: "QB12",
          stats: {
            standard: {},
            ppr: {},
            half: {},
          },
          rankings: {},
        },
      };
      const result = CombinedEntry.parse(input);
      expect(result.player_id).toBe("12345");
      expect(result.name).toBe("john doe");
      expect(result.position).toBe("QB");
      expect(result.team).toBe("TB");
      expect(result.bye_week).toBe(9);
      expect(result.sleeper.week).toBeNull();
      expect(result.fantasypros?.player_id).toBe("12345");
    });

    it("should reject missing required fields", () => {
      const invalid = {
        player_id: "12345",
        name: "john doe",
        // missing position
        team: "TB",
        bye_week: 9,
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
      };
      expect(() => CombinedEntry.parse(invalid)).toThrow();
    });

    it("should handle fantasypros as null", () => {
      const input = {
        player_id: "12345",
        name: "john doe",
        position: "QB",
        team: null,
        bye_week: null,
        borischen: {
          std: null,
          ppr: null,
          half: null,
        },
        sleeper: {
          stats: {
            adp_std: 12.5,
            adp_half_ppr: 11.2,
            adp_ppr: 10.8,
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
      };
      const result = CombinedEntry.parse(input);
      expect(result.player_id).toBe("12345");
      expect(result.team).toBeNull();
      expect(result.bye_week).toBe(0); // null gets coerced to 0
      expect(result.sleeper.week).toBeNull();
      expect(result.sleeper.updated_at).toBeNull();
      expect(result.fantasypros).toBeNull();
    });
  });

  describe("CombinedShard", () => {
    it("should parse valid shard", () => {
      const input = {
        "12345": {
          player_id: "12345",
          name: "john doe",
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
            updated_at: 1640995200000,
          },
          fantasypros: null,
        },
      };
      const result = CombinedShard.parse(input);
      expect(result["12345"].player_id).toBe("12345");
      expect(result["12345"].sleeper.week).toBeNull();
      expect(result["12345"].fantasypros).toBeNull();
    });

    it("should reject invalid entries in shard", () => {
      const invalid = {
        "12345": {
          player_id: "12345",
          name: "john doe",
          // missing required fields
          borischen: {
            std: null,
            ppr: null,
            half: null,
          },
        },
      };
      expect(() => CombinedShard.parse(invalid)).toThrow();
    });
  });
});
