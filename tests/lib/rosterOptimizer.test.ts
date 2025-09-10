import { describe, it, expect } from "vitest";
import { determineRecommendedRoster, type Player } from "@/lib/rosterOptimizer";

// Helper function to create test players
function createPlayer(
  id: string,
  position: string,
  borisChenRank: number | null,
  fantasyProsEcr: number | null
): Player {
  return {
    player_id: id,
    position: position as any,
    borisChenRank,
    fantasyProsEcr,
  };
}

describe("determineRecommendedRoster", () => {
  it("should return empty lineups when no players provided", () => {
    const result = determineRecommendedRoster([], {});
    expect(result).toEqual({
      fantasyPros: [],
      borisChen: [],
    });
  });

  it("should fill all roster positions with best ranked players", () => {
    const rosterPositions = [
      "RB",
      "RB",
      "WR",
      "WR",
      "FLEX",
      "FLEX",
      "QB",
      "K",
      "DEF",
      "TE",
    ];
    const userPlayerIds = [
      "rb1",
      "rb2",
      "rb3",
      "wr1",
      "wr2",
      "wr3",
      "te1",
      "flex1",
      "flex2",
      "flex3",
      "qb1",
      "k1",
      "def1",
    ];

    const playerData = {
      QB: {
        qb1: createPlayer("qb1", "QB", 1, 2),
      },
      K: {
        k1: createPlayer("k1", "K", 1, 2),
      },
      DEF: {
        def1: createPlayer("def1", "DEF", 1, 2),
      },
      RB: {
        rb1: createPlayer("rb1", "RB", 1, 2),
        rb2: createPlayer("rb2", "RB", 2, 1),
        rb3: createPlayer("rb3", "RB", 3, 3),
      },
      WR: {
        wr1: createPlayer("wr1", "WR", 1, 2),
        wr2: createPlayer("wr2", "WR", 2, 1),
        wr3: createPlayer("wr3", "WR", 3, 3),
      },
      TE: {
        te1: createPlayer("te1", "TE", 1, 2),
      },
      FLEX: {
        flex1: createPlayer("flex1", "RB", 1, 2),
        flex2: createPlayer("flex2", "RB", 2, 1),
        flex3: createPlayer("flex3", "RB", 3, 3),
      },
    };

    const result = determineRecommendedRoster(
      userPlayerIds,
      playerData,
      rosterPositions
    );

    expect(result.fantasyPros).toHaveLength(10);
    expect(result.fantasyPros).toEqual([
      {
        position: "RB",
        slot: "RB1",
        playerId: "rb2",
      },
      {
        position: "RB",
        slot: "RB2",
        playerId: "rb1",
      },
      {
        position: "WR",
        slot: "WR1",
        playerId: "wr2",
      },
      {
        position: "WR",
        slot: "WR2",
        playerId: "wr1",
      },
      {
        position: "QB",
        slot: "QB1",
        playerId: "qb1",
      },
      {
        position: "K",
        slot: "K1",
        playerId: "k1",
      },
      {
        position: "DEF",
        slot: "DEF1",
        playerId: "def1",
      },
      {
        position: "TE",
        slot: "TE1",
        playerId: "te1",
      },
      {
        position: "RB",
        slot: "FLEX1",
        playerId: "rb3",
      },
      {
        position: "WR",
        slot: "FLEX2",
        playerId: "wr3",
      },
    ]);
    expect(result.borisChen).toHaveLength(10);
    expect(result.borisChen).toEqual([
      {
        position: "RB",
        slot: "RB1",
        playerId: "rb1",
      },
      {
        position: "RB",
        slot: "RB2",
        playerId: "rb2",
      },
      {
        position: "WR",
        slot: "WR1",
        playerId: "wr1",
      },
      {
        position: "WR",
        slot: "WR2",
        playerId: "wr2",
      },
      {
        position: "QB",
        slot: "QB1",
        playerId: "qb1",
      },
      {
        position: "K",
        slot: "K1",
        playerId: "k1",
      },
      {
        position: "DEF",
        slot: "DEF1",
        playerId: "def1",
      },
      {
        position: "TE",
        slot: "TE1",
        playerId: "te1",
      },
      {
        position: "RB",
        slot: "FLEX1",
        playerId: "rb3",
      },
      {
        position: "WR",
        slot: "FLEX2",
        playerId: "wr3",
      },
    ]);
  });

  it("breaks ties deterministically (other ranking then id)", () => {
    const rosterPositions = ["WR", "WR", "FLEX"];
    const userPlayerIds = ["wrA", "wrB", "rbA"];
    const playerData = {
      WR: {
        wrA: createPlayer("wrA", "WR", 10, 20),
        wrB: createPlayer("wrB", "WR", 10, 30), // worse boris
      },
      RB: {
        rbA: createPlayer("rbA", "RB", 10, 20),
      },
      QB: {},
      K: {},
      DEF: {},
      TE: {},
      FLEX: {},
    } as Record<string, Record<string, Player>>;

    const res = determineRecommendedRoster(
      userPlayerIds,
      playerData,
      rosterPositions
    );
    // WR slots (ECR ties): wrA before wrB due to better Boris;
    // FLEX from leftovers: rbA vs none -> rbA
    expect(res.fantasyPros.map((s) => s.playerId)).toEqual([
      "wrA",
      "wrB",
      "rbA",
    ]);
  });

  it("fills SUPERFLEX after dedicated slots", () => {
    const rosterPositions = ["QB", "RB", "SUPERFLEX"];
    const userPlayerIds = ["qb1", "rb1", "qb2"];
    const playerData = {
      QB: {
        qb1: createPlayer("qb1", "QB", 1, 1),
        qb2: createPlayer("qb2", "QB", 2, 2),
      },
      RB: {
        rb1: createPlayer("rb1", "RB", 1, 1),
      },
      WR: {},
      TE: {},
      K: {},
      DEF: {},
      FLEX: {},
    } as Record<string, Record<string, Player>>;

    const res = determineRecommendedRoster(
      userPlayerIds,
      playerData,
      rosterPositions
    );
    expect(res.fantasyPros.map((s) => [s.slot, s.playerId])).toEqual([
      ["QB1", "qb1"], // dedicated first
      ["RB1", "rb1"], // dedicated second
      ["SUPERFLEX1", "qb2"], // flex last
    ]);
  });
});
