import { describe, expect, it } from "vitest";

import {
  buildStarterAwareValues,
  buildStarterAwareStrategy,
  calculateBeerPlusProjectedPoints,
  reconcileSleeperStandardProjection,
} from "@/lib/beerPlusStrategy";
import { DEFAULT_DRAFT_SCORING_RULES } from "@/lib/draftLeagueConfig";
import { DEFAULT_DRAFT_ROSTER_SLOTS } from "@/lib/draftLeagueConfig";

describe("Beer+ strategy", () => {
  it("calculates exact 0.69-PPR points from raw projection statistics", () => {
    const points = calculateBeerPlusProjectedPoints({
      position: "RB",
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
      stats: {
        rec: 100,
        rush_yd: 1_000,
        rec_yd: 500,
        rush_td: 10,
        rec_td: 5,
        fum_lost: 2,
      },
    });

    expect(points).toBe(305);
  });

  it("allocates FLEX only after direct starters and changes baselines with two FLEX slots", () => {
    const players = [
      ...makePlayers("RB", [300, 290, 280, 270, 260]),
      ...makePlayers("WR", [295, 285, 275, 265, 255]),
      ...makePlayers("TE", [200, 100, 90]),
    ];
    const oneFlex = buildStarterAwareValues({
      teams: 1,
      rosterSlots: { ...DEFAULT_DRAFT_ROSTER_SLOTS, FLEX: 1 },
      players,
    });
    const twoFlex = buildStarterAwareValues({
      teams: 1,
      rosterSlots: { ...DEFAULT_DRAFT_ROSTER_SLOTS, FLEX: 2 },
      players,
    });

    expect(oneFlex.flexAllocation).toEqual({ RB: 1, WR: 0, TE: 0 });
    expect(twoFlex.flexAllocation).toEqual({ RB: 1, WR: 1, TE: 0 });
    expect(twoFlex.relevantPlayerCounts.WR.vols).toBe(
      oneFlex.relevantPlayerCounts.WR.vols + 1
    );
    expect(twoFlex.valuesByPlayerId["WR-1"]?.volsBaseline).toBeLessThan(
      oneFlex.valuesByPlayerId["WR-1"]?.volsBaseline ?? 0
    );
  });

  it("changes cross-position points when the league scoring changes", () => {
    const rbStats = { rec: 80, rush_yd: 900, rec_yd: 500, rush_td: 8, rec_td: 3 };
    const standard = calculateBeerPlusProjectedPoints({
      position: "RB",
      scoringRules: { ...DEFAULT_DRAFT_SCORING_RULES, reception: 0 },
      stats: rbStats,
    });
    const fullPpr = calculateBeerPlusProjectedPoints({
      position: "RB",
      scoringRules: { ...DEFAULT_DRAFT_SCORING_RULES, reception: 1 },
      stats: rbStats,
    });
    expect(fullPpr - standard).toBe(80);
  });

  it("counts passing touchdowns once", () => {
    const points = calculateBeerPlusProjectedPoints({
      position: "QB",
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
      stats: { pass_td: 30 },
    });

    expect(points).toBe(120);
  });

  it("uses Sleeper standard projected points for standard kicker scoring", () => {
    const points = calculateBeerPlusProjectedPoints({
      position: "K",
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
      stats: { pts_std: 137.5, fgm_50p: 1, xpm: 1 },
    });

    expect(points).toBe(137.5);
  });

  it("names two-point conversions when reconciling Sleeper standard points", () => {
    expect(reconcileSleeperStandardProjection({
      position: "QB",
      stats: {
        pass_yd: 4_000,
        pass_td: 30,
        pass_int: 10,
        pass_2pt: 2,
        rush_yd: 0,
        rush_td: 0,
        pts_std: 274,
      },
    })).toMatchObject({
      supportedPoints: 270,
      difference: 4,
      status: "named-unsupported",
      causes: ["two-point conversions"],
    });
  });

  it("does not excuse an unexplained difference only because hybrid IDP fields exist", () => {
    expect(reconcileSleeperStandardProjection({
      position: "WR",
      stats: {
        rec: 10,
        rec_yd: 100,
        rec_td: 1,
        idp_int: 1,
        idp_fum_rec: 1,
        pts_std: 21,
      },
    })).toMatchObject({
      supportedPoints: 16,
      difference: 5,
      status: "unexplained",
      causes: [],
    });
  });

  it("preserves each position projection curve while assigning it by FantasyPros rank", () => {
    const strategy = buildStarterAwareStrategy({
      artifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-03T00:00:00.000Z",
        sourceLastModified: "2026-09-03T00:00:00.000Z",
        players: {
          "rb-ecr-1": {
            playerId: "rb-ecr-1",
            position: "RB",
            stats: {
              rush_yd: 800,
              rush_td: 0,
              rec: 20,
              rec_yd: 100,
              rec_td: 0,
              pts_std: 90,
              pts_ppr: 110,
            },
            lastModified: 1,
            newsUpdated: null,
          },
          "rb-ecr-2": {
            playerId: "rb-ecr-2",
            position: "RB",
            stats: {
              rush_yd: 1_600,
              rush_td: 0,
              rec: 40,
              rec_yd: 200,
              rec_td: 0,
              pts_std: 180,
              pts_ppr: 220,
            },
            lastModified: 1,
            newsUpdated: null,
          },
        },
      },
      players: [
        { playerId: "rb-ecr-1", position: "RB", ecr: 1 },
        { playerId: "rb-ecr-2", position: "RB", ecr: 2 },
      ],
      teams: 1,
      rounds: 2,
      rosterSlots: {
        ...DEFAULT_DRAFT_ROSTER_SLOTS,
        QB: 0,
        RB: 1,
        WR: 0,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
        BENCH: 1,
      },
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    });

    expect(strategy.status.available).toBe(true);
    expect(strategy.result?.valuesByPlayerId["rb-ecr-1"]).toMatchObject({
      rawProjectedPoints: 103.8,
      projectedPoints: 207.6,
    });
    expect(strategy.result?.valuesByPlayerId["rb-ecr-2"]).toMatchObject({
      rawProjectedPoints: 207.6,
      projectedPoints: 103.8,
    });
  });

  it("does not enable the strategy when projection data is missing", () => {
    const status = buildStarterAwareStrategy({
      artifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-08-01T00:00:00.000Z",
        sourceLastModified: "2026-08-01T00:00:00.000Z",
        players: {},
      },
      players: [{ playerId: "rb-1", position: "RB", ecr: 1 }],
      teams: 1,
      rounds: 1,
      rosterSlots: { ...DEFAULT_DRAFT_ROSTER_SLOTS, QB: 0, WR: 0, TE: 0, DEF: 0, FLEX: 0 },
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    });
    expect(status.status.available).toBe(false);
    expect(status.status.reason).toContain("RB");
    expect(status.result).toBeNull();
  });

  it("does not treat missing required statistics as zero", () => {
    const status = buildStarterAwareStrategy({
      artifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-03T00:00:00.000Z",
        sourceLastModified: "2026-09-03T00:00:00.000Z",
        players: {
          "rb-1": {
            playerId: "rb-1",
            position: "RB",
            stats: {},
            lastModified: 1,
            newsUpdated: null,
          },
        },
      },
      players: [{ playerId: "rb-1", position: "RB", ecr: 1 }],
      teams: 1,
      rounds: 1,
      rosterSlots: { ...DEFAULT_DRAFT_ROSTER_SLOTS, QB: 0, WR: 0, TE: 0, DEF: 0, FLEX: 0 },
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    });
    expect(status.status.available).toBe(false);
    expect(status.status.requiredStatCoveragePct).toBe(0);
    expect(status.result).toBeNull();
  });

  it("does not treat a missing material touchdown projection as zero", () => {
    const strategy = buildStarterAwareStrategy({
      artifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-03T00:00:00.000Z",
        sourceLastModified: "2026-09-03T00:00:00.000Z",
        players: {
          "rb-1": {
            playerId: "rb-1",
            position: "RB",
            stats: { rush_yd: 900, rec: 30, rec_yd: 240, rec_td: 2 },
            lastModified: 1,
            newsUpdated: null,
          },
        },
      },
      players: [{ playerId: "rb-1", position: "RB", ecr: 1 }],
      teams: 1,
      rounds: 1,
      rosterSlots: {
        ...DEFAULT_DRAFT_ROSTER_SLOTS,
        QB: 0,
        RB: 1,
        WR: 0,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
        BENCH: 0,
      },
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    });

    expect(strategy.status.available).toBe(false);
    expect(strategy.status.missingPositions).toContain("RB");
    expect(strategy.result).toBeNull();
  });

  it("rejects omitted QB rushing production that does not reconcile", () => {
    const strategy = buildStarterAwareStrategy({
      artifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-03T00:00:00.000Z",
        sourceLastModified: "2026-09-03T00:00:00.000Z",
        players: {
          "qb-1": {
            playerId: "qb-1",
            position: "QB",
            stats: {
              pass_yd: 4_000,
              pass_td: 30,
              pass_int: 10,
              pts_std: 276,
              pts_ppr: 276,
            },
            lastModified: 1,
            newsUpdated: null,
          },
        },
      },
      players: [{ playerId: "qb-1", position: "QB", ecr: 1 }],
      teams: 1,
      rounds: 1,
      rosterSlots: {
        ...DEFAULT_DRAFT_ROSTER_SLOTS,
        QB: 1,
        RB: 0,
        WR: 0,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
        BENCH: 0,
      },
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    });

    expect(strategy.status.available).toBe(false);
    expect(strategy.status.missingPositions).toContain("QB");
  });

  it("accepts an omitted zero field only when Sleeper standard points prove it", () => {
    const strategy = buildStarterAwareStrategy({
      artifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-03T00:00:00.000Z",
        sourceLastModified: "2026-09-03T00:00:00.000Z",
        players: {
          "rb-1": {
            playerId: "rb-1",
            position: "RB",
            stats: {
              rush_yd: 900,
              rush_td: 5,
              rec: 30,
              rec_yd: 240,
              pts_std: 144,
            },
            lastModified: 1,
            newsUpdated: null,
          },
        },
      },
      players: [{ playerId: "rb-1", position: "RB", ecr: 1 }],
      teams: 1,
      rounds: 1,
      rosterSlots: {
        ...DEFAULT_DRAFT_ROSTER_SLOTS,
        QB: 0,
        RB: 1,
        WR: 0,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
        BENCH: 0,
      },
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    });

    expect(strategy.status).toMatchObject({
      available: true,
      capabilityLimitations: [],
    });
    expect(strategy.result?.valuesByPlayerId["rb-1"]?.rawProjectedPoints)
      .toBe(164.7);
  });

  it("removes kicker demand when the league has no kicker slot", () => {
    const withoutKicker = buildStarterAwareValues({
      teams: 12,
      rosterSlots: { ...DEFAULT_DRAFT_ROSTER_SLOTS, K: 0 },
      players: [{ playerId: "k-1", position: "K", projectedPoints: 150 }],
    });
    const withKicker = buildStarterAwareValues({
      teams: 12,
      rosterSlots: { ...DEFAULT_DRAFT_ROSTER_SLOTS, K: 1 },
      players: [{ playerId: "k-1", position: "K", projectedPoints: 150 }],
    });
    expect(withoutKicker.relevantPlayerCounts.K.vols).toBe(0);
    expect(withKicker.relevantPlayerCounts.K.vols).toBe(12);
  });

  it("supports standard Sleeper kicker scoring from the projected-point total", () => {
    const strategy = buildStarterAwareStrategy({
      artifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-03T00:00:00.000Z",
        sourceLastModified: "2026-09-03T00:00:00.000Z",
        players: {
          kicker: {
            playerId: "kicker",
            position: "K",
            stats: { pts_std: 97, fgm_40_49: 8, fgm_50p: 4, xpm: 30, xpmiss: 1 },
            lastModified: 1,
            newsUpdated: null,
          },
        },
      },
      players: [{ playerId: "kicker", position: "K", ecr: 1 }],
      teams: 1,
      rounds: 1,
      rosterSlots: {
        ...DEFAULT_DRAFT_ROSTER_SLOTS,
        QB: 0,
        RB: 0,
        WR: 0,
        TE: 0,
        K: 1,
        DEF: 0,
        FLEX: 0,
        BENCH: 0,
      },
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    });

    expect(strategy.status.available).toBe(true);
    expect(strategy.status.capabilityLimitations).toEqual([]);
    expect(strategy.result?.valuesByPlayerId.kicker?.rawProjectedPoints).toBe(97);
  });

  it("rejects custom kicker scoring without field-goal distance splits", () => {
    const strategy = buildStarterAwareStrategy({
      artifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-03T00:00:00.000Z",
        sourceLastModified: "2026-09-03T00:00:00.000Z",
        players: {
          kicker: {
            playerId: "kicker",
            position: "K",
            stats: { fgm_50p: 4, xpm: 30 },
            lastModified: 1,
            newsUpdated: null,
          },
        },
      },
      players: [{ playerId: "kicker", position: "K", ecr: 1 }],
      teams: 1,
      rounds: 1,
      rosterSlots: {
        ...DEFAULT_DRAFT_ROSTER_SLOTS,
        QB: 0,
        RB: 0,
        WR: 0,
        TE: 0,
        K: 1,
        DEF: 0,
        FLEX: 0,
        BENCH: 0,
      },
      scoringRules: {
        ...DEFAULT_DRAFT_SCORING_RULES,
        fieldGoalUnder50: 0,
      },
    });

    expect(strategy.status.available).toBe(false);
    expect(strategy.status.capabilityLimitations).toContainEqual(
      expect.objectContaining({
        code: "UNSUPPORTED_SCORING_RULE",
        scoringKey: "fieldGoalUnder50",
        position: "K",
      })
    );
  });
});

function makePlayers(position: "RB" | "WR" | "TE", points: number[]) {
  return points.map((projectedPoints, index) => ({
    playerId: `${position}-${index + 1}`,
    position,
    projectedPoints,
  }));
}
