// tests/lib/enrichPlayers.test.ts
import { describe, it, expect } from "vitest";
import {
  enrichPlayers,
  type EnrichedPlayer,
} from "../../src/lib/enrichPlayers";
import { CombinedEntryT } from "../../src/lib/schemas-aggregates";
import { ScoringType } from "../../src/lib/schemas";

describe("enrichPlayers", () => {
  const mockCombinedEntry: CombinedEntryT = {
    player_id: "12345",
    name: "John Doe",
    position: "QB",
    team: "TB",
    bye_week: 9,
    borischen: {
      std: { rank: 12, tier: 3 },
      ppr: { rank: 11, tier: 3 },
      half: { rank: 10, tier: 3 },
    },
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
    fantasypros: {
      player_id: "12345",
      player_owned_avg: 15.5,
      pos_rank: "QB12",
      stats: {
        standard: { FPTS: 296, FPTS_AVG: 18.5 },
        ppr: { FPTS_AVG: 19.2 },
        half: { FPTS_AVG: 18.8 },
      },
      rankings: {
        standard: { rank_ecr: 42, tier: 5 },
        ppr: { rank_ecr: 41, tier: 5 },
        half: { rank_ecr: 43, tier: 5 },
      },
    },
  };

  const mockLeague = {
    teams: 12,
    scoring: "std" as ScoringType,
    roster: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      BENCH: 6,
    },
  };

  it("should enrich players with computed fields", () => {
    const result = enrichPlayers([mockCombinedEntry], mockLeague);

    expect(result).toHaveLength(1);
    const enriched = result[0];

    // Check that original fields are preserved
    expect(enriched.player_id).toBe("12345");
    expect(enriched.name).toBe("John Doe");
    expect(enriched.position).toBe("QB");

    // Check Boris Chen enrichment
    expect(enriched.bc_rank).toBe(12);
    expect(enriched.bc_tier).toBe(3);

    // Check Sleeper enrichment
    expect(enriched.sleeper_pts).toBe(320.5);
    expect(enriched.sleeper_adp).toBe(45.2);

    // Check FantasyPros enrichment
    expect(enriched.fp_pts).toBe(296);
    expect(enriched.fp_adp).toBeNull();
    expect(enriched.fp_rank_overall).toBe(42);
    expect(enriched.fp_tier).toBe(5);
    expect(enriched.fp_player_owned_avg).toBe(15.5);

    // Check computed fields
    expect(enriched.fp_value).toBeDefined();
    expect(enriched.fp_baseline_pts).toBeDefined();
    expect(enriched.market_delta).toBeDefined();
    expect(enriched.fp_positional_scarcity).toBeDefined();
    expect(enriched.fp_replacement_slope).toBeDefined();
  });

  it("should handle different scoring types", () => {
    const pprLeague = { ...mockLeague, scoring: "ppr" as ScoringType };
    const result = enrichPlayers([mockCombinedEntry], pprLeague);

    expect(result[0].bc_rank).toBe(11); // PPR rank
    expect(result[0].sleeper_pts).toBe(350.8); // PPR points
    expect(result[0].fp_pts).toBe(19.2); // PPR fantasy points
  });

  it("should work correctly with all scoring types", () => {
    const scoringTypes: ScoringType[] = ["std", "ppr", "half"];

    for (const scoring of scoringTypes) {
      const league = { ...mockLeague, scoring };
      const result = enrichPlayers([mockCombinedEntry], league);
      const enriched = result[0];

      // Verify that enrichment works for each scoring type
      expect(enriched.bc_rank).toBeDefined();
      expect(enriched.sleeper_pts).toBeDefined();
      expect(enriched.fp_pts).toBeDefined();

      // Check that the correct scoring-specific data is used
      if (scoring === "std") {
        expect(enriched.bc_rank).toBe(12);
        expect(enriched.sleeper_pts).toBe(320.5);
        expect(enriched.fp_pts).toBe(296);
      } else if (scoring === "ppr") {
        expect(enriched.bc_rank).toBe(11);
        expect(enriched.sleeper_pts).toBe(350.8);
        expect(enriched.fp_pts).toBe(19.2);
      } else if (scoring === "half") {
        expect(enriched.bc_rank).toBe(10);
        expect(enriched.sleeper_pts).toBe(340.2);
        expect(enriched.fp_pts).toBe(18.8);
      }
    }
  });

  it("should handle null/undefined values gracefully", () => {
    const entryWithNulls: CombinedEntryT = {
      ...mockCombinedEntry,
      borischen: {
        std: null,
        ppr: null,
        half: null,
      },
      sleeper: {
        ...mockCombinedEntry.sleeper,
        stats: {
          adp_std: null,
          adp_half_ppr: null,
          adp_ppr: null,
          pts_std: null,
          pts_half_ppr: null,
          pts_ppr: null,
        },
      },
      fantasypros: null,
    };

    const result = enrichPlayers([entryWithNulls], mockLeague);

    expect(result[0].bc_rank).toBeNull();
    expect(result[0].bc_tier).toBeNull();
    expect(result[0].sleeper_pts).toBeNull();
    expect(result[0].sleeper_adp).toBeNull();
    expect(result[0].fp_pts).toBeNull();
    expect(result[0].fp_rank_overall).toBeNull();
  });

  it("should calculate market delta correctly", () => {
    const result = enrichPlayers([mockCombinedEntry], mockLeague);
    const enriched = result[0];

    // market_delta = sleeper_adp - fp_rank_overall = 45.2 - 42 = 3.2, rounded to whole number
    expect(enriched.market_delta).toBe(3);
  });

  it("should return empty array for empty input", () => {
    const result = enrichPlayers([], mockLeague);
    expect(result).toEqual([]);
  });

  it("should compute overall rank from ADP when available", () => {
    const result = enrichPlayers([mockCombinedEntry], mockLeague);
    const enriched = result[0];

    // sleeper_adp = 45.2, should be ranked around that position
    expect(enriched.sleeper_rank_overall).toBeDefined();
    expect(typeof enriched.sleeper_rank_overall).toBe("number");
  });

  it("should compute positional scarcity metrics", () => {
    const result = enrichPlayers([mockCombinedEntry], mockLeague);
    const enriched = result[0];

    expect(enriched.fp_positional_scarcity).toBeDefined();
    expect(enriched.fp_replacement_slope).toBeDefined();
    expect(enriched.fp_scarcity_index).toBeDefined();
    expect(enriched.fp_remaining_value_pct).toBeDefined();
  });

  it("should preserve original CombinedEntry structure", () => {
    const result = enrichPlayers([mockCombinedEntry], mockLeague);
    const enriched = result[0];

    // Check that all original fields are still present
    expect(enriched.borischen).toEqual(mockCombinedEntry.borischen);
    expect(enriched.sleeper).toEqual(mockCombinedEntry.sleeper);
    expect(enriched.fantasypros).toEqual(mockCombinedEntry.fantasypros);
  });
});

describe("enrichPlayers FLEX & baseline smoke", () => {
  // League: 1 team, RB2/WR3/TE1 + 1 FLEX, no QB/K/DEF
  const league = {
    teams: 1,
    scoring: "std" as ScoringType,
    roster: {
      QB: 0,
      RB: 2,
      WR: 3,
      TE: 1,
      FLEX: 1,
      K: 0,
      DEF: 0,
      BENCH: 6,
    },
  };

  // Helper to make a minimal CombinedEntryT with just enough fields used by enrichPlayers
  function makeEntry(
    id: string,
    name: string,
    pos: "RB" | "WR" | "TE",
    fpts: number,
    ecr: number,
    posRank: string
  ): CombinedEntryT {
    return {
      player_id: id,
      name,
      position: pos,
      team: "TEAM",
      bye_week: 9,
      borischen: { std: null, ppr: null, half: null },
      sleeper: {
        stats: {
          adp_std: null,
          adp_half_ppr: null,
          adp_ppr: null,
          pts_std: null,
          pts_half_ppr: null,
          pts_ppr: null,
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
        player_id: id,
        player_owned_avg: null,
        pos_rank: posRank,
        stats: {
          standard: { FPTS: fpts },
        },
        rankings: {
          standard: { rank_ecr: ecr, tier: 1 },
        },
      },
    } as unknown as CombinedEntryT;
  }

  // RB points (desc): 240, 230, 220
  const RB1 = makeEntry("rb1", "RB One", "RB", 240, 10, "RB1");
  const RB2 = makeEntry("rb2", "RB Two", "RB", 230, 20, "RB2");
  const RB3 = makeEntry("rb3", "RB Three", "RB", 220, 30, "RB3");

  // WR points (desc): 300, 180, 170, 160
  const WR1 = makeEntry("wr1", "WR One", "WR", 300, 11, "WR1");
  const WR2 = makeEntry("wr2", "WR Two", "WR", 180, 21, "WR2");
  const WR3 = makeEntry("wr3", "WR Three", "WR", 170, 31, "WR3");
  const WR4 = makeEntry("wr4", "WR Four", "WR", 160, 41, "WR4");

  // TE points (desc): 150, 140
  const TE1 = makeEntry("te1", "TE One", "TE", 150, 12, "TE1");
  const TE2 = makeEntry("te2", "TE Two", "TE", 140, 22, "TE2");

  const players: CombinedEntryT[] = [
    RB1,
    RB2,
    RB3,
    WR1,
    WR2,
    WR3,
    WR4,
    TE1,
    TE2,
  ];

  it("allocates FLEX by marginals and applies VORP baseline per position", () => {
    const enriched = enrichPlayers(players, league);

    // Put results in a map by id for quick lookup
    const byId = new Map(enriched.map((p) => [p.player_id, p]));

    // With base starters RB2/WR3/TE1 and 1 FLEX, the marginal candidates are:
    // RB[2]=220, WR[3]=160, TE[1]=140 -> FLEX should go to RB (220)
    // Therefore starters become: RB=3, WR=3, TE=1
    // VORP baseline (first bench) -> index n (clamped):
    //   RB baseline = RB[2] = 220
    //   WR baseline = WR[3] = 160
    //   TE baseline = TE[1] = 140

    expect(byId.get("rb1")!.fp_baseline_pts).toBe(220);
    expect(byId.get("wr1")!.fp_baseline_pts).toBe(160);
    expect(byId.get("te1")!.fp_baseline_pts).toBe(140);

    // Sanity: values reflect (totals - baseline), allow negatives
    expect(byId.get("rb1")!.fp_value).toBe(240 - 220);
    expect(byId.get("wr2")!.fp_value).toBe(180 - 160);
    expect(byId.get("te2")!.fp_value).toBe(140 - 140); // zero at replacement

    // No phantom K/DEF starters should be inferred (league sets them to 0)
    // We simply assert nothing crashed and players array length equals enriched length
    expect(enriched).toHaveLength(players.length);
  });
});
