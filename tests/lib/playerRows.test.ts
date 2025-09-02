// tests/lib/playerRows.test.ts
import { describe, it, expect } from "vitest";
import {
  toPlayerRows,
  mapToPlayerRow,
  type PlayerRow,
} from "../../src/lib/playerRows";
import { enrichPlayers } from "../../src/lib/enrichPlayers";
import { CombinedEntryT } from "../../src/lib/schemas-aggregates";
import { ScoringType } from "../../src/lib/schemas";

describe("Player Rows", () => {
  const mockCombinedEntry: CombinedEntryT = {
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
        standard: { FPTS_AVG: 18.5 },
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

  describe("toPlayerRows", () => {
    it("should convert EnrichedPlayer array to PlayerRow array", () => {
      const enriched = enrichPlayers([mockCombinedEntry], mockLeague);
      const rows = toPlayerRows(enriched, {}, mockLeague.teams);

      expect(rows).toHaveLength(1);
      const row = rows[0];

      expect(row).toMatchObject({
        player_id: "12345",
        name: "John Doe",
        position: "QB",
        team: "TB",
        bye_week: 9,
        bc_rank: 12,
        bc_tier: 3,
        sleeper_pts: 320.5,
        sleeper_adp: 45.2,
        fp_pts: 18.5,
        fp_rank_overall: 42,
        fp_tier: 5,
        fp_player_owned_avg: 15.5,
      });

      // Check that computed fields are included
      expect(row.fp_value).toBeDefined();
      expect(row.fp_baseline_pts).toBeDefined();
      expect(row.market_delta).toBeDefined();
    });

    it("should handle extras from BeerSheets", () => {
      const enriched = enrichPlayers([mockCombinedEntry], mockLeague);
      const extras = {
        "12345": {
          val: 15.5,
          ps: 75,
          ecr_round_pick: "R4-P3",
        },
        "normalizePlayerName(John Doe)": {
          val: 16.0,
          ps: 80,
        },
      };

      const rows = toPlayerRows(enriched, extras, mockLeague.teams);
      const row = rows[0];

      expect(row.val).toBe(15.5); // Direct ID match takes precedence
      expect(row.ps).toBe(75);
      expect(row.ecr_round_pick).toBe("R4-P3");
    });

    it("should handle empty enriched array", () => {
      const rows = toPlayerRows([], {}, mockLeague.teams);
      expect(rows).toEqual([]);
    });

    it("should calculate ecr_round_pick when not provided in extras", () => {
      const enriched = enrichPlayers([mockCombinedEntry], mockLeague);
      const rows = toPlayerRows(enriched, {}, mockLeague.teams);
      const row = rows[0];

      expect(row.ecr_round_pick).toBeDefined();
      expect(typeof row.ecr_round_pick).toBe("string");
    });
  });

  describe("mapToPlayerRow (legacy)", () => {
    it("should convert arbitrary player objects to PlayerRow", () => {
      const playerLike = {
        player_id: "67890",
        name: "Jane Smith",
        position: "RB",
        team: "KC",
        bye_week: 10,
        rank: 25,
        tier: 2,
      };

      const rows = mapToPlayerRow([playerLike]);

      expect(rows).toHaveLength(1);
      const row = rows[0];

      expect(row).toMatchObject({
        player_id: "67890",
        name: "Jane Smith",
        position: "RB",
        team: "KC",
        bye_week: 10,
        rank: 25,
        tier: 2,
      });
    });

    it("should handle nested player objects", () => {
      const playerLike = {
        id: "67890",
        full_name: "Jane Smith",
        pos: "RB",
        pro_team: "KC",
        bye: 10,
        player: {
          rank: 25,
          tier: 2,
        },
      };

      const rows = mapToPlayerRow([playerLike]);

      expect(rows).toHaveLength(1);
      const row = rows[0];

      expect(row.player_id).toBe("67890");
      expect(row.name).toBe("Jane Smith");
      expect(row.position).toBe("RB");
      expect(row.team).toBe("KC");
      expect(row.bye_week).toBe(10);
      expect(row.rank).toBe(25);
      expect(row.tier).toBe(2);
    });

    it("should handle extras mapping", () => {
      const playerLike = {
        player_id: "67890",
        name: "Jane Smith",
        position: "RB",
      };

      const extras = {
        "67890": {
          val: 12.5,
          ps: 65,
          ecr_round_pick: "R3-P8",
        },
      };

      const rows = mapToPlayerRow([playerLike], extras);

      expect(rows[0].val).toBe(12.5);
      expect(rows[0].ps).toBe(65);
      expect(rows[0].ecr_round_pick).toBe("R3-P8");
    });

    it("should handle name-based extras lookup", () => {
      const playerLike = {
        player_id: "67890",
        name: "Jane Smith",
        position: "RB",
      };

      const extras = {
        "jane smith": {
          val: 12.5,
          ps: 65,
        },
      };

      const rows = mapToPlayerRow([playerLike], extras);

      expect(rows[0].val).toBe(12.5);
      expect(rows[0].ps).toBe(65);
    });

    it("should handle all player objects including minimal ones", () => {
      const validPlayer = {
        player_id: "67890",
        name: "Jane Smith",
        position: "RB",
        team: "KC",
        bye_week: 10,
      };

      const minimalPlayer = {
        name: "Minimal Player",
      };

      const rows = mapToPlayerRow([validPlayer, minimalPlayer]);

      // Should include both players (schema allows minimal objects)
      expect(rows).toHaveLength(2);
      expect(rows[0].player_id).toBe("67890");
      expect(rows[1].player_id).toBe(""); // empty string for missing id
      expect(rows[1].name).toBe("Minimal Player");
    });
  });
});
