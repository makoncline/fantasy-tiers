import { describe, expect, it } from "vitest";
import {
  assignContiguousTiers,
  buildTierRows,
  type FantasyProsDraftRow,
} from "../../scripts/tiers/generate-local-tiers";

function row(
  name: string,
  position: string,
  rank: number,
  averageRank = rank
): FantasyProsDraftRow {
  return {
    player_name: name,
    player_positions: position,
    rank_ecr: rank,
    rank_min: rank,
    rank_max: rank,
    rank_ave: averageRank,
    rank_std: 0.5,
  };
}

describe("local tier generation", () => {
  it("clusters obvious rank gaps into contiguous tiers", () => {
    expect(assignContiguousTiers([1, 2, 3, 20, 21, 22], 2)).toEqual([
      1, 1, 1, 2, 2, 2,
    ]);
  });

  it("builds FLEX tier CSV rows from only RB, WR, and TE players", () => {
    const rows = buildTierRows(
      [
        row("Quarterback", "QB", 1),
        row("Receiver", "WR", 2),
        row("Runner", "RB", 3),
        row("Tight End", "TE", 4),
        row("Kicker", "K", 5),
      ],
      {
        outputPosition: "FLEX",
        scoring: "ppr",
        limit: 10,
        tierCount: 2,
      }
    );

    expect(rows.map((entry) => entry["Player.Name"])).toEqual([
      "Receiver",
      "Runner",
      "Tight End",
    ]);
    expect(rows[0]).toMatchObject({
      Rank: 1,
      Matchup: "",
      "Best.Rank": 2,
      "Worst.Rank": 2,
      "Avg.Rank": 2,
      "Std.Dev": 0.5,
    });
    expect(rows.every((entry) => typeof entry.Tier === "number")).toBe(true);
  });
});
