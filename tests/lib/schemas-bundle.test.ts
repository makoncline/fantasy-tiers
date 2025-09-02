import { describe, it, expect } from "vitest";
import {
  AggregatesBundlePlayer,
  AggregatesBundleResponse,
  AggregatesBundleQueryParams,
  RosterSlotsSchema,
} from "@/lib/schemas-bundle";

describe("AggregatesBundlePlayer schema", () => {
  it("validates a complete player object", () => {
    const validPlayer = {
      player_id: "1234",
      name: "John Doe",
      position: "RB",
      team: "SF",
      bye_week: 9,
      borischen: { rank: 4, tier: 1 },
      sleeper: { rank: 4, adp: 3.2, pts: 263.4 },
      fantasypros: {
        rank: 4,
        tier: 1,
        pos_rank: "RB1",
        ecr: 4,
        ecr_round_pick: "1.03",
        pts: 278.1,
        baseline_pts: 192.5,
        adp: null,
        player_owned_avg: 97.3,
      },
      calc: { value: 86, positional_scarcity: 62, market_delta: -1 },
    };

    const result = AggregatesBundlePlayer.safeParse(validPlayer);
    expect(result.success).toBe(true);
  });

  it("validates with nullable fields", () => {
    const playerWithNulls = {
      player_id: "1234",
      name: "John Doe",
      position: "RB",
      team: null,
      bye_week: null,
      borischen: { rank: null, tier: null },
      sleeper: { rank: null, adp: null, pts: null },
      fantasypros: {
        rank: null,
        tier: null,
        pos_rank: null,
        ecr: null,
        ecr_round_pick: null,
        pts: null,
        baseline_pts: null,
        adp: null,
        player_owned_avg: null,
      },
      calc: { value: null, positional_scarcity: null, market_delta: null },
    };

    const result = AggregatesBundlePlayer.safeParse(playerWithNulls);
    expect(result.success).toBe(true);
  });

  it("rejects invalid player object", () => {
    const invalidPlayer = {
      player_id: 1234, // Should be string
      name: "John Doe",
      position: "INVALID", // Invalid position
      team: "SF",
      bye_week: 9,
    };

    const result = AggregatesBundlePlayer.safeParse(invalidPlayer);
    expect(result.success).toBe(false);
  });
});

describe("AggregatesBundleResponse schema", () => {
  it("validates a complete response", () => {
    const validResponse = {
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

    const result = AggregatesBundleResponse.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it("rejects invalid response", () => {
    const invalidResponse = {
      lastModified: "invalid", // Should be number
      scoring: "invalid", // Should be valid scoring type
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

    const result = AggregatesBundleResponse.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });
});

describe("AggregatesBundleQueryParams schema", () => {
  it("validates valid query parameters", () => {
    const validParams = {
      scoring: "ppr",
      teams: "12",
      slots_qb: "1",
      slots_rb: "2",
      slots_wr: "2",
      slots_te: "1",
      slots_k: "1",
      slots_def: "1",
      slots_flex: "1",
    };

    const result = AggregatesBundleQueryParams.safeParse(validParams);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scoring).toBe("ppr");
      expect(result.data.teams).toBe(12);
      expect(result.data.slots_qb).toBe(1);
    }
  });

  it("transforms string teams to number", () => {
    const params = {
      scoring: "std",
      teams: "10",
    };

    const result = AggregatesBundleQueryParams.safeParse(params);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teams).toBe(10);
    }
  });

  it("rejects invalid teams value", () => {
    const params = {
      scoring: "std",
      teams: "0", // Invalid: must be > 0
    };

    const result = AggregatesBundleQueryParams.safeParse(params);
    expect(result.success).toBe(false);
  });

  it("rejects invalid scoring type", () => {
    const params = {
      scoring: "invalid",
      teams: "12",
    };

    const result = AggregatesBundleQueryParams.safeParse(params);
    expect(result.success).toBe(false);
  });
});

describe("RosterSlotsSchema", () => {
  it("validates complete roster slots", () => {
    const validRoster = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      K: 1,
      DEF: 1,
      FLEX: 1,
      BENCH: 0,
    };

    const result = RosterSlotsSchema.safeParse(validRoster);
    expect(result.success).toBe(true);
  });

  it("rejects roster with missing fields", () => {
    const invalidRoster = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      // Missing K, DEF, FLEX, BENCH
    };

    const result = RosterSlotsSchema.safeParse(invalidRoster);
    expect(result.success).toBe(false);
  });
});
