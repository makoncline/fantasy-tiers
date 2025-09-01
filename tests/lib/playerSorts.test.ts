import { describe, it, expect } from "vitest";
import { sortByBcRank, findBaseline } from "../../src/lib/playerSorts";
import type { PlayerRow } from "../../src/lib/playerRows";

describe("Player Sorts", () => {
  const mockRows: PlayerRow[] = [
    {
      player_id: "1",
      name: "Player A",
      position: "QB",
      team: "TB",
      bye_week: 9,
      bc_rank: 3,
    },
    {
      player_id: "2",
      name: "Player B",
      position: "QB",
      team: "KC",
      bye_week: 10,
      bc_rank: 1,
    },
    {
      player_id: "3",
      name: "Player C",
      position: "QB",
      team: "SF",
      bye_week: 11,
      bc_rank: 2,
    },
    {
      player_id: "4",
      name: "Player D",
      position: "QB",
      team: "GB",
      bye_week: 12,
      bc_rank: undefined,
    },
  ];

  const mockRowsWithBaselines: PlayerRow[] = [
    {
      player_id: "1",
      name: "Player A",
      position: "QB",
      team: "TB",
      bye_week: 9,
      fp_baseline_pts: 15.5,
    },
    {
      player_id: "2",
      name: "Player B",
      position: "QB",
      team: "KC",
      bye_week: 10,
      fp_baseline_pts: undefined,
    },
    {
      player_id: "3",
      name: "Player C",
      position: "QB",
      team: "SF",
      bye_week: 11,
      fp_baseline_pts: 20.0,
    },
  ];

  describe("sortByBcRank", () => {
    it("should sort players by bc_rank in ascending order", () => {
      const sorted = sortByBcRank(mockRows);

      expect(sorted[0].bc_rank).toBe(1); // Player B
      expect(sorted[1].bc_rank).toBe(2); // Player C
      expect(sorted[2].bc_rank).toBe(3); // Player A
      expect(sorted[3].bc_rank).toBeUndefined(); // Player D (undefined ranks last)
    });

    it("should handle empty array", () => {
      const sorted = sortByBcRank([]);
      expect(sorted).toEqual([]);
    });

    it("should handle all undefined ranks", () => {
      const allUndefined = mockRows.map((row) => ({
        ...row,
        bc_rank: undefined,
      }));
      const sorted = sortByBcRank(allUndefined);
      expect(sorted).toHaveLength(4);
    });

    it("should preserve original array (immutable)", () => {
      const original = [...mockRows];
      sortByBcRank(mockRows);

      expect(mockRows).toEqual(original);
    });
  });

  describe("findBaseline", () => {
    it("should find the first player with fp_baseline_pts", () => {
      const baseline = findBaseline(mockRowsWithBaselines);
      expect(baseline).toBe(15.5);
    });

    it("should return undefined when no player has fp_baseline_pts", () => {
      const noBaselines = mockRows.map((row) => ({
        ...row,
        fp_baseline_pts: undefined,
      }));
      const baseline = findBaseline(noBaselines);
      expect(baseline).toBeUndefined();
    });

    it("should return undefined for empty array", () => {
      const baseline = findBaseline([]);
      expect(baseline).toBeUndefined();
    });

    it("should find baseline even when not the first player", () => {
      const reorderedRows = [
        mockRowsWithBaselines[1], // No baseline
        mockRowsWithBaselines[2], // Has baseline 20.0
        mockRowsWithBaselines[0], // Has baseline 15.5
      ];

      const baseline = findBaseline(reorderedRows);
      expect(baseline).toBe(20.0); // First player with baseline
    });
  });
});
