import { describe, expect, it } from "vitest";
import {
  attachDraftValueMetrics,
  buildDraftValueBoard as buildProductionDraftValueBoard,
  type DraftValueBoardInput,
  type DraftValuePlayerInput,
} from "@/lib/draftValue";

function buildDraftValueBoard<TPlayer extends DraftValuePlayerInput>(
  input: DraftValueBoardInput<TPlayer>
) {
  const players = input.players.map((player, index) => ({
    ...player,
    fp_rank_ave:
      player.fp_rank_ave ?? player.tier_rank ?? player.rank ?? index + 1,
    fp_rank_pos: player.fp_rank_pos ?? index + 1,
    position_tier_level:
      player.position_tier_level ?? player.tier_level ?? player.tier ?? 1,
  }));
  return buildProductionDraftValueBoard({ ...input, players });
}

describe("buildDraftValueBoard", () => {
  const rosterRequirements = {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    K: 1,
    DEF: 1,
    BN: 6,
  };

  it("ranks a needed tier-cliff value as a take-now recommendation", () => {
    const players = [
      {
        player_id: "rb1",
        name: "Anchor RB",
        position: "RB",
        tier_rank: 8,
        tier_level: 1,
        fp_pts: 300,
        fp_value: 80,
        sleeper_adp: 8,
      },
      {
        player_id: "rb2",
        name: "Fallback RB",
        position: "RB",
        tier_rank: 30,
        tier_level: 2,
        fp_pts: 230,
        fp_value: 25,
        sleeper_adp: 25,
      },
      {
        player_id: "wr1",
        name: "Wideout",
        position: "WR",
        tier_rank: 10,
        tier_level: 1,
        fp_pts: 285,
        fp_value: 55,
        sleeper_adp: 18,
      },
      {
        player_id: "wr2",
        name: "Wideout Two",
        position: "WR",
        tier_rank: 18,
        tier_level: 1,
        fp_pts: 265,
        fp_value: 45,
        sleeper_adp: 22,
      },
    ] as const;

    const board = buildDraftValueBoard({
      players,
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 15,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 0, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 2, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.nextPick).toBe(16);
    expect(board.recommendations[0]?.player_id).toBe("rb1");
    const metrics = board.metricsByPlayerId.rb1;
    expect(metrics?.actionLabel).toBe("take now");
    expect(metrics?.sameTierFallbackCount).toBe(0);
    expect(metrics?.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["BEST_VALUE", "TIER_CLIFF", "ROSTER_NEED"])
    );
  });

  it("calculates comeback odds against the next turn after the current user pick", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr1",
          name: "Early First Round WR",
          position: "WR",
          tier_rank: 3,
          tier_level: 1,
          fp_pts: 300,
          fp_value: 95,
          sleeper_adp: 6.6,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 5,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 0, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 2, WR: 2, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.nextPick).toBe(5);
    expect(board.picksUntilNextTurn).toBe(0);
    expect(board.metricsByPlayerId.wr1?.comebackProbability).toBeLessThan(0.2);
    expect(board.metricsByPlayerId.wr1?.comebackLabel).toBe("unlikely");
  });

  it("builds VAL from named recommendation components and exposes one top pick", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr1",
          name: "Clear WR",
          position: "WR",
          tier_rank: 10,
          tier_level: 2,
          fp_rank_ave: 10.2,
          fp_rank_pos: 5,
          fp_pts: 270,
          fp_value: 55,
          sleeper_adp: 18,
        },
        {
          player_id: "rb1",
          name: "Challenger RB",
          position: "RB",
          tier_rank: 14,
          tier_level: 3,
          fp_rank_ave: 14.3,
          fp_rank_pos: 8,
          fp_pts: 245,
          fp_value: 38,
          sleeper_adp: 20,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 16,
      userSlot: 6,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    const top = board.topRecommendation;
    expect(top?.player.player_id).toBe("wr1");
    expect(top?.metrics.recommendationConfidence).toBe("high");
    expect(top?.metrics.recommendationScoreGap).toBeGreaterThan(12);
    expect(top?.challengers[0]).toMatchObject({ playerId: "rb1" });

    const metrics = board.metricsByPlayerId.wr1;
    const topPlayer = board.recommendations[0];
    if (!metrics || !topPlayer) {
      throw new Error("Expected WR metrics and top recommendation");
    }
    expect(metrics?.weightProfile).toBe("starter_build");
    expect(metrics?.rawScores.value).toBeGreaterThan(55);
    expect(metrics?.staticValue).toBeGreaterThan(metrics?.rawScores.value ?? 0);
    expect(metrics?.weights.starterNeed).toBeGreaterThan(0);
    const weightedStarterNeed = Math.round(
      ((metrics?.rawScores.starterNeed ?? 0) *
        (metrics?.weights.starterNeed ?? 0)) *
        10
    ) / 10;
    expect(metrics?.components.starterNeed).toBe(weightedStarterNeed);

    const components = metrics?.components;
    expect(components).toBeDefined();
    const componentTotal = Object.values(components ?? {}).reduce(
      (total, value) => total + value,
      0
    );
    expect(Math.round(componentTotal * 10) / 10).toBe(
      metrics?.recommendationScore
    );
    expect(metrics?.topComponents[0]?.label).toBe("ECR value");
    expect(metrics.recommendationExplanation.edge.detail).toContain(
      "higher tier than Challenger RB (RB)"
    );
    expect(metrics.recommendationExplanation.pros).toEqual(
      expect.arrayContaining([
        "You need to fill WR.",
        "Likely last pick to get Tier 2 WR.",
      ])
    );
    expect(metrics.recommendationExplanation.dataQuality).toHaveLength(0);

    const attached = attachDraftValueMetrics(topPlayer, metrics);
    expect(attached.draft_recommendation_summary).toBe(
      metrics.recommendationSummary
    );
    expect(attached.draft_recommendation_edge_detail).toBe(
      metrics.recommendationExplanation.edge.detail
    );
    expect(attached.draft_recommendation_pros).toEqual(
      metrics.recommendationExplanation.pros
    );
  });

  it("uses intervening team roster demand to adjust comeback odds by position", () => {
    const teamRosterStates = Array.from({ length: 10 }, (_, index) => {
      const draftSlot = index + 1;
      const betweenCurrentAndNextPick = draftSlot >= 6;
      return {
        draftSlot,
        positionCounts: betweenCurrentAndNextPick
          ? { QB: 1, RB: 2, WR: 0, TE: 1, K: 0, DEF: 0 }
          : { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 },
        starterNeeds: betweenCurrentAndNextPick
          ? { QB: 0, RB: 0, WR: 2, TE: 0, FLEX: 1, K: 1, DEF: 1 }
          : { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1 },
        benchSlotsRemaining: 6,
      };
    });
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr1",
          name: "Same ADP WR",
          position: "WR",
          tier_rank: 35,
          tier_level: 4,
          fp_value: 40,
          sleeper_adp: 36,
        },
        {
          player_id: "qb1",
          name: "Same ADP QB",
          position: "QB",
          tier_rank: 35,
          tier_level: 4,
          fp_value: 40,
          sleeper_adp: 36,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 25,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
      teamRosterStates,
    });

    const wrComeback = board.metricsByPlayerId.wr1?.comebackProbability;
    const qbComeback = board.metricsByPlayerId.qb1?.comebackProbability;

    expect(wrComeback).toBeLessThan(0.25);
    expect(qbComeback).toBeGreaterThan(0.45);
    expect(wrComeback).toBeLessThan(qbComeback ?? 0);
  });

  it("uses FantasyPros ECR average as the default static value baseline", () => {
    const players = [
      {
        player_id: "rb1",
        name: "Best ECR RB",
        position: "RB",
        tier_rank: 3,
        tier_level: 1,
        fp_pts: 210,
        fp_value: 1,
        fp_rank_ave: 3.2,
        fp_rank_pos: 1,
        sleeper_adp: 4,
      },
      {
        player_id: "rb2",
        name: "Worse ECR RB",
        position: "RB",
        tier_rank: 8,
        tier_level: 2,
        fp_pts: 320,
        fp_value: 999,
        fp_rank_ave: 8.4,
        fp_rank_pos: 2,
        sleeper_adp: 8,
      },
      {
        player_id: "rb3",
        name: "Bench RB",
        position: "RB",
        tier_rank: 22,
        tier_level: 3,
        fp_rank_ave: 22.1,
        fp_rank_pos: 3,
        sleeper_adp: 22,
      },
      {
        player_id: "rb4",
        name: "Replacement RB",
        position: "RB",
        tier_rank: 30,
        tier_level: 4,
        fp_rank_ave: 30.6,
        fp_rank_pos: 4,
        sleeper_adp: 30,
      },
    ] as const;

    const board = buildDraftValueBoard({
      players,
      teams: 2,
      rounds: 4,
      draftType: "snake",
      currentPick: 1,
      userSlot: 1,
      rosterRequirements: {
        QB: 0,
        RB: 1,
        WR: 0,
        TE: 0,
        FLEX: 0,
        K: 0,
        DEF: 0,
        BN: 3,
      },
      userPositionCounts: { RB: 0 },
      userPositionNeeds: { RB: 1, BN: 3 },
    });

    const best = board.metricsByPlayerId.rb1;
    const worse = board.metricsByPlayerId.rb2;
    expect(board.recommendations[0]?.player_id).toBe("rb1");
    expect(best?.staticValue ?? 0).toBeGreaterThan(worse?.staticValue ?? 0);
    expect("projectedPoints" in (best ?? {})).toBe(false);
    expect("beer" in (best ?? {})).toBe(false);
    expect("vols" in (best ?? {})).toBe(false);
    expect("beerPlus" in (best ?? {})).toBe(false);
  });

  it("keeps players with missing ECR visible but recommendation-ineligible", () => {
    const board = buildProductionDraftValueBoard({
      players: [
        {
          player_id: "missing",
          name: "Missing ECR",
          position: "RB",
          tier_rank: 1,
          tier_level: 1,
          position_tier_level: 1,
          fp_rank_pos: 1,
          sleeper_adp: 1,
        },
        {
          player_id: "ranked",
          name: "Ranked Player",
          position: "WR",
          tier_rank: 20,
          tier_level: 3,
          position_tier_level: 2,
          fp_rank_ave: 20,
          fp_rank_pos: 10,
          sleeper_adp: 20,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 1,
      userSlot: 1,
      rosterRequirements,
      userPositionCounts: {},
      userPositionNeeds: { RB: 2, WR: 2, FLEX: 1, QB: 1, TE: 1 },
    });

    expect(board.recommendations.map((player) => player.player_id)).toEqual([
      "ranked",
    ]);
    expect(board.metricsByPlayerId.missing).toMatchObject({
      staticValue: null,
      recommendationRank: null,
      sourceConfidence: "low",
      missingFields: expect.arrayContaining(["ecr"]),
    });
  });

  it("does not let a small RB value edge beat a higher-tier WR reach on the first pick", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb1",
          name: "Early ADP Reach RB",
          position: "RB",
          tier_rank: 20,
          tier_level: 3,
          fp_value: 90,
          sleeper_adp: 25,
        },
        {
          player_id: "wr1",
          name: "Higher Tier WR",
          position: "WR",
          tier_rank: 5,
          tier_level: 1,
          fp_value: 84,
          sleeper_adp: 6,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 5,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 0, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 2, WR: 2, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.recommendations[0]?.player_id).toBe("wr1");
    expect(board.metricsByPlayerId.rb1?.components.timing).toBeLessThan(0);
  });

  it("blocks RB3 before WR1 unless the value gap is decisive", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb3",
          name: "Third RB",
          position: "RB",
          tier_rank: 25,
          tier_level: 4,
          fp_value: 75,
          sleeper_adp: 28,
        },
        {
          player_id: "wr1",
          name: "First WR",
          position: "WR",
          tier_rank: 24,
          tier_level: 3,
          fp_value: 68,
          sleeper_adp: 27,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 25,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 2, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.recommendations[0]?.player_id).toBe("wr1");
    expect(board.metricsByPlayerId.rb3?.recommendationExplanation.cons)
      .toContain("Leaves WR starter spots empty.");
    expect(board.metricsByPlayerId.wr1?.recommendationExplanation.pros)
      .toContain("Improves RB/WR ratio.");
  });

  it("uses WR1 as the early tie-breaker after opening RB", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb2",
          name: "Close Second RB",
          position: "RB",
          tier_rank: 21,
          tier_level: 3,
          fp_value: 78,
          sleeper_adp: 22,
        },
        {
          player_id: "wr1",
          name: "First WR Starter",
          position: "WR",
          tier_rank: 18,
          tier_level: 2,
          fp_value: 72,
          fp_rank_pos: 8,
          sleeper_adp: 21,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 16,
      userSlot: 6,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 2, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.rb2?.recommendationExplanation.cons)
      .toContain("WR starter is still empty.");
    expect(board.metricsByPlayerId.wr1?.recommendationExplanation.pros)
      .toContain("Improves RB/WR ratio.");
    expect(board.recommendations[0]?.player_id).toBe("wr1");
  });

  it("prefers WR2 over RB3 flex when the WR is close and higher tier", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb3",
          name: "Flex RB",
          position: "RB",
          tier_rank: 36,
          tier_level: 7,
          fp_value: 68,
          sleeper_adp: 36,
        },
        {
          player_id: "wr2",
          name: "Second WR",
          position: "WR",
          tier_rank: 34,
          tier_level: 5,
          fp_value: 60,
          sleeper_adp: 38,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 36,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.recommendations[0]?.player_id).toBe("wr2");
  });

  it("protects WR2 before taking an RB3 flex value", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb3",
          name: "Strong Flex RB",
          position: "RB",
          tier_rank: 46,
          tier_level: 6,
          fp_value: 105,
          sleeper_adp: 44,
        },
        {
          player_id: "wr2",
          name: "Needed WR2",
          position: "WR",
          tier_rank: 50,
          tier_level: 7,
          fp_value: 38,
          fp_rank_pos: 24,
          sleeper_adp: 48,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 45,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 1, QB: 0, TE: 1, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 1, FLEX: 1, QB: 1, TE: 0, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.rb3?.recommendationExplanation.cons)
      .toContain("WR2 is still empty.");
    expect(board.recommendations[0]?.player_id).toBe("wr2");
  });

  it("infers WR-heavy roster construction when early picks skipped RB", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb1",
          name: "RB",
          position: "RB",
          tier_rank: 12,
          tier_level: 2,
          fp_pts: 240,
          sleeper_adp: 16,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 31,
      userSlot: 10,
      rosterRequirements,
      userPositionCounts: { RB: 0, WR: 3, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 2, WR: 0, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.rosterConstruction.label).toBe("WR-heavy");
    expect(board.rosterConstruction.detail).toContain("RB urgency");
    expect(board.rosterConstruction.starterHoles).toContain("RB 2");
    expect(board.rosterConstruction.flexOpen).toBe(1);
  });

  it("warns before doubling one core position while the other starter anchor is open", () => {
    const rbFirst = buildDraftValueBoard({
      players: [
        {
          player_id: "wr1",
          name: "WR",
          position: "WR",
          tier_rank: 10,
          tier_level: 2,
          fp_pts: 260,
          sleeper_adp: 18,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 18,
      userSlot: 8,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 2, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(rbFirst.rosterConstruction.warnings).toContain(
      "WR starter anchor is still open; compare before doubling RB."
    );

    const wrFirst = buildDraftValueBoard({
      players: [
        {
          player_id: "rb1",
          name: "RB",
          position: "RB",
          tier_rank: 10,
          tier_level: 2,
          fp_pts: 260,
          sleeper_adp: 18,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 18,
      userSlot: 8,
      rosterRequirements,
      userPositionCounts: { RB: 0, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 2, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(wrFirst.rosterConstruction.warnings).toContain(
      "RB starter anchor is still open; compare before doubling WR."
    );
  });

  it("adds source and news risk reasons without hiding usable value", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr1",
          name: "Questionable WR",
          position: "WR",
          bye_week: 8,
          tier_rank: 6,
          tier_level: 1,
          fp_pts: 280,
          fp_value: 70,
          sleeper_adp: 11,
          sleeper_injury_status: "Questionable",
          sleeper_injury_notes: "Limited in practice.",
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 9,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 2, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
      userRosterPlayers: [
        { name: "RB A", position: "RB", bye_week: 8 },
        { name: "RB B", position: "RB", bye_week: 8 },
        { name: "TE A", position: "TE", bye_week: 8 },
      ],
      sourceWarnings: ["FantasyPros projections were not fetched."],
    });

    const reasons = board.metricsByPlayerId.wr1?.reasons.map(
      (reason) => reason.code
    );
    expect(reasons).toEqual(
      expect.arrayContaining(["SOURCE_WARNING", "NEWS_RISK"])
    );
    expect(board.rosterConstruction.byeWarnings).toContain(
      "3 RB/WR/TE players share Week 8 bye."
    );
  });

  it("adjusts urgency for room-wide position demand", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb1",
          name: "Room Need RB",
          position: "RB",
          tier_rank: 30,
          tier_level: 3,
          fp_pts: 220,
          fp_value: 30,
          sleeper_adp: 40,
        },
        {
          player_id: "qb1",
          name: "Low Demand QB",
          position: "QB",
          tier_rank: 31,
          tier_level: 3,
          fp_pts: 320,
          fp_value: 30,
          sleeper_adp: 40,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 30,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 1, TE: 1, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 0, QB: 0, TE: 0, K: 1, DEF: 1 },
      draftWideNeeds: { RB: 8, WR: 2, QB: 0, TE: 1, K: 10, DEF: 10 },
    });

    expect(board.metricsByPlayerId.rb1?.roomDemandScore).toBe(1.5);
    expect(board.metricsByPlayerId.rb1?.reasons.map((reason) => reason.code))
      .toContain("ROOM_DEMAND");
    expect(board.metricsByPlayerId.qb1?.roomDemandScore).toBe(-1.5);
  });

  it("uses RB/WR bench balance to resolve close depth calls", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb1",
          name: "Slightly Better RB",
          position: "RB",
          tier_rank: 95,
          tier_level: 10,
          fp_pts: 175,
          fp_value: 41,
          sleeper_adp: 112,
        },
        {
          player_id: "wr1",
          name: "Balance WR",
          position: "WR",
          tier_rank: 96,
          tier_level: 10,
          fp_pts: 174,
          fp_value: 40,
          sleeper_adp: 112,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 108,
      userSlot: 8,
      rosterRequirements,
      userPositionCounts: { RB: 4, WR: 4, QB: 1, TE: 1, K: 0, DEF: 0, BN: 4 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 0,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 2,
      },
    });

    expect(board.rosterConstruction.benchBalance).toMatchObject({
      rbCount: 4,
      wrCount: 4,
      rbTarget: 6,
      wrTarget: 5,
      targetPosition: "RB",
      status: "tie-break",
    });
    expect(board.metricsByPlayerId.rb1?.reasons.map((reason) => reason.code))
      .toContain("BENCH_BALANCE");
    expect(board.metricsByPlayerId.rb1?.weightProfile).toBe("depth_build");
    expect(board.metricsByPlayerId.rb1?.components.depth ?? 0)
      .toBeGreaterThan(0);
    expect(board.recommendations[0]?.player_id).toBe("rb1");
  });

  it("leans RB in the middle rounds when WR depth is adequate and RB depth is shallow", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr4",
          name: "Higher Ranked WR Depth",
          position: "WR",
          tier_rank: 68,
          tier_level: 8,
          fp_rank_ave: 68,
          fp_rank_pos: 24,
          sleeper_adp: 70,
        },
        {
          player_id: "rb3",
          name: "Needed RB Depth",
          position: "RB",
          tier_rank: 82,
          tier_level: 9,
          fp_rank_ave: 82,
          fp_rank_pos: 25,
          sleeper_adp: 84,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 70,
      userSlot: 10,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 1, TE: 1, K: 0, DEF: 0, BN: 0 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 1,
        QB: 0,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 5,
      },
    });

    expect(board.metricsByPlayerId.rb3?.reasons.map((reason) => reason.label))
      .toContain("RB depth");
    expect(board.metricsByPlayerId.wr4?.reasons.map((reason) => reason.label))
      .toContain("RB depth risk");
    expect(board.recommendations[0]?.player_id).toBe("rb3");
  });

  it("keeps bench balance inactive until RB/WR/FLEX starter quality is stable", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr1",
          name: "Early WR",
          position: "WR",
          tier_rank: 12,
          tier_level: 2,
          fp_pts: 260,
          fp_value: 50,
          sleeper_adp: 18,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 12,
      userSlot: 2,
      rosterRequirements,
      userPositionCounts: { RB: 0, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0, BN: 0 },
      userPositionNeeds: {
        RB: 2,
        WR: 2,
        FLEX: 1,
        QB: 1,
        TE: 1,
        K: 1,
        DEF: 1,
        BN: 6,
      },
    });

    expect(board.rosterConstruction.benchBalance).toMatchObject({
      rbCount: 0,
      wrCount: 0,
      rbTarget: 6,
      wrTarget: 5,
      targetPosition: null,
      status: "balanced",
      label: "Core first",
    });
    expect(board.metricsByPlayerId.wr1?.reasons.map((reason) => reason.code))
      .not.toContain("BENCH_BALANCE");
  });

  it("escalates RB/WR bench balance when the roster is materially lopsided", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb1",
          name: "More RB Value",
          position: "RB",
          tier_rank: 100,
          tier_level: 11,
          fp_pts: 180,
          fp_value: 43,
          sleeper_adp: 120,
        },
        {
          player_id: "wr1",
          name: "Needed WR Depth",
          position: "WR",
          tier_rank: 101,
          tier_level: 11,
          fp_pts: 177,
          fp_value: 39,
          sleeper_adp: 120,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 118,
      userSlot: 8,
      rosterRequirements,
      userPositionCounts: { RB: 5, WR: 2, QB: 1, TE: 1, K: 0, DEF: 0, BN: 4 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 0,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 2,
      },
    });

    expect(board.rosterConstruction.benchBalance).toMatchObject({
      rbCount: 5,
      wrCount: 2,
      rbTarget: 6,
      wrTarget: 5,
      targetPosition: "WR",
      status: "action",
    });
    expect(board.rosterConstruction.warnings).toContain(
      "RB/WR bench depth is lopsided; prefer WR unless the value gap is clear."
    );
    expect(board.metricsByPlayerId.rb1?.reasons.map((reason) => reason.label))
      .toContain("Balance risk");
    expect(board.metricsByPlayerId.wr1?.reasons.map((reason) => reason.code))
      .toContain("BENCH_BALANCE");
  });

  it("treats a two-player RB/WR bench target gap as action after starters are filled", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb4",
          name: "Extra RB",
          position: "RB",
          tier_rank: 78,
          tier_level: 10,
          fp_value: 40,
          sleeper_adp: 80,
        },
        {
          player_id: "wr3",
          name: "Needed WR Depth",
          position: "WR",
          tier_rank: 82,
          tier_level: 10,
          fp_value: 34,
          sleeper_adp: 82,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 75,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 3, WR: 4, QB: 1, TE: 1, K: 0, DEF: 0, BN: 1 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 0,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 5,
      },
    });

    expect(board.rosterConstruction.benchBalance).toMatchObject({
      rbCount: 3,
      wrCount: 4,
      rbGap: 3,
      wrGap: 1,
      targetPosition: "RB",
      status: "action",
    });
    expect(board.recommendations[0]?.player_id).toBe("rb4");
    expect(board.metricsByPlayerId.wr3?.recommendationExplanation.cons)
      .toContain("Need more RB depth.");
  });

  it("protects the RB and WR depth floor before adding extra depth", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb6",
          name: "Extra RB",
          position: "RB",
          tier_rank: 112,
          tier_level: 14,
          fp_value: 44,
          sleeper_adp: 122,
        },
        {
          player_id: "wr5",
          name: "Floor WR",
          position: "WR",
          tier_rank: 116,
          tier_level: 14,
          fp_value: 38,
          sleeper_adp: 123,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 121,
      userSlot: 1,
      rosterRequirements,
      userPositionCounts: { RB: 5, WR: 4, QB: 1, TE: 1, K: 0, DEF: 0, BN: 5 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 0,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 1,
      },
    });

    expect(board.rosterConstruction.benchBalance).toMatchObject({
      targetPosition: "WR",
      status: "action",
    });
    expect(board.metricsByPlayerId.wr5?.reasons.map((reason) => reason.code))
      .toContain("BENCH_BALANCE");
    expect(board.metricsByPlayerId.rb6?.recommendationExplanation.cons)
      .toContain("Need more WR depth.");
    expect(board.recommendations[0]?.player_id).toBe("wr5");
  });

  it("prefers RB/WR bench utility over backup QB and early kicker", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb2",
          name: "Backup QB",
          position: "QB",
          tier_rank: 70,
          tier_level: 6,
          fp_pts: 330,
          sleeper_adp: 125,
        },
        {
          player_id: "rb4",
          name: "Bench RB",
          position: "RB",
          tier_rank: 80,
          tier_level: 7,
          fp_pts: 185,
          sleeper_adp: 126,
        },
        {
          player_id: "k1",
          name: "Early Kicker",
          position: "K",
          tier_rank: 90,
          tier_level: 8,
          fp_pts: 150,
          sleeper_adp: 130,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 111,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 1, TE: 1, K: 0, DEF: 0, BN: 3 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 0,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 3,
      },
      draftWideNeeds: { RB: 4, WR: 4, QB: 0, TE: 0, K: 10, DEF: 10 },
    });

    expect(board.metricsByPlayerId.qb2?.benchPolicyScore).toBeLessThan(-10);
    expect(board.metricsByPlayerId.qb2?.reasons.map((reason) => reason.code))
      .toContain("ONESIE_FILLED");
    expect(board.metricsByPlayerId.rb4?.benchPolicyScore).toBeGreaterThan(0);
    expect(board.metricsByPlayerId.rb4?.reasons.map((reason) => reason.code))
      .toContain("BENCH_UPSIDE");
    expect(board.metricsByPlayerId.k1?.reasons.map((reason) => reason.code))
      .toContain("K_DEF_WAIT");
    expect(board.recommendations[0]?.player_id).toBe("rb4");
  });

  it("prefers WR depth over a second TE in normal 1TE builds", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "te2",
          name: "Backup TE Value",
          position: "TE",
          tier_rank: 74,
          tier_level: 8,
          fp_value: 46,
          fp_rank_pos: 7,
          sleeper_adp: 78,
        },
        {
          player_id: "wr4",
          name: "Bench WR",
          position: "WR",
          tier_rank: 82,
          tier_level: 10,
          fp_value: 30,
          fp_rank_pos: 42,
          sleeper_adp: 82,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 80,
      userSlot: 6,
      rosterRequirements,
      userPositionCounts: { RB: 3, WR: 3, QB: 1, TE: 1, K: 0, DEF: 0, BN: 1 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 0,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 5,
      },
    });

    expect(board.metricsByPlayerId.te2?.reasons.map((reason) => reason.code))
      .toContain("ONESIE_FILLED");
    expect(board.recommendations[0]?.player_id).toBe("wr4");
  });

  it("flags tier-one tight ends as elite starter windows when TE is open", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "te1",
          name: "Elite TE",
          position: "TE",
          tier_rank: 18,
          tier_level: 2,
          position_tier_level: 1,
          fp_rank_ave: 18.1,
          fp_rank_pos: 1,
          fp_pts: 245,
          fp_value: 45,
          sleeper_adp: 22,
        },
        {
          player_id: "te2",
          name: "Second Elite TE",
          position: "TE",
          tier_rank: 24,
          tier_level: 3,
          position_tier_level: 1,
          fp_rank_ave: 24.1,
          fp_rank_pos: 2,
          fp_pts: 240,
          fp_value: 42,
          sleeper_adp: 26,
        },
        {
          player_id: "te3",
          name: "Later TE",
          position: "TE",
          tier_rank: 50,
          tier_level: 7,
          position_tier_level: 2,
          fp_rank_ave: 50.1,
          fp_rank_pos: 3,
          fp_pts: 205,
          fp_value: 20,
          sleeper_adp: 55,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 20,
      userSlot: 10,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_TE_STARTER");
    expect(board.metricsByPlayerId.te2?.reasons.map((reason) => reason.code))
      .toContain("ELITE_TE_STARTER");
    expect(
      board.metricsByPlayerId.te1?.reasons
        .slice(0, 2)
        .map((reason) => reason.code)
    ).toContain("ELITE_TE_STARTER");
    expect(
      board.metricsByPlayerId.te2?.reasons
        .slice(0, 2)
        .map((reason) => reason.code)
    ).toContain("ELITE_TE_STARTER");
    expect(board.metricsByPlayerId.te3?.reasons.map((reason) => reason.code))
      .not.toContain("ELITE_TE_STARTER");
  });

  it("takes an elite TE over a close RB value once the round three window opens", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb2",
          name: "Close RB",
          position: "RB",
          tier_rank: 24,
          tier_level: 4,
          fp_pts: 230,
          fp_value: 62,
          fp_rank_pos: 13,
          sleeper_adp: 27,
        },
        {
          player_id: "te1",
          name: "Elite TE",
          position: "TE",
          tier_rank: 25,
          tier_level: 4,
          position_tier_level: 1,
          fp_pts: 225,
          fp_value: 58,
          fp_rank_pos: 2,
          sleeper_adp: 28,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 29,
      userSlot: 9,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_TE_STARTER");
    expect(board.recommendations[0]?.player_id).toBe("te1");
  });

  it("flags elite QB at ADP but waits on non-elite QB and TE while FLEX value is live", () => {
    const eliteBoard = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Elite QB",
          position: "QB",
          tier_rank: 20,
          tier_level: 2,
          position_tier_level: 1,
          fp_value: 42,
          fp_rank_pos: 3,
          sleeper_adp: 24,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 24,
      userSlot: 2,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(eliteBoard.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_QB_STARTER");

    const waitBoard = buildDraftValueBoard({
      players: [
        {
          player_id: "qb8",
          name: "Useful QB",
          position: "QB",
          tier_rank: 62,
          tier_level: 8,
          fp_value: 44,
          fp_rank_pos: 8,
          sleeper_adp: 68,
        },
        {
          player_id: "te7",
          name: "Useful TE",
          position: "TE",
          tier_rank: 66,
          tier_level: 8,
          fp_value: 38,
          fp_rank_pos: 7,
          sleeper_adp: 72,
        },
        {
          player_id: "wr3",
          name: "Live FLEX WR",
          position: "WR",
          tier_rank: 54,
          tier_level: 7,
          fp_value: 36,
          fp_rank_pos: 30,
          sleeper_adp: 63,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 61,
      userSlot: 1,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(waitBoard.metricsByPlayerId.qb8?.reasons.map((reason) => reason.code))
      .toContain("ONESIE_WAIT");
    expect(waitBoard.metricsByPlayerId.te7?.reasons.map((reason) => reason.code))
      .toContain("STARTER_DEADLINE");
    expect(waitBoard.recommendations[0]?.player_id).toBe("te7");
  });

  it("waits on tier-one QB and TE when the pick is still before FantasyPros ECR", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Early Elite QB",
          position: "QB",
          tier_rank: 52,
          tier_level: 6,
          position_tier_level: 1,
          fp_rank_ave: 52,
          fp_rank_pos: 2,
          sleeper_adp: 45,
        },
        {
          player_id: "te1",
          name: "Early Elite TE",
          position: "TE",
          tier_rank: 50,
          tier_level: 5,
          position_tier_level: 1,
          fp_rank_ave: 50,
          fp_rank_pos: 2,
          sleeper_adp: 44,
        },
        {
          player_id: "wr2",
          name: "Starter WR At ECR",
          position: "WR",
          tier_rank: 41,
          tier_level: 5,
          fp_rank_ave: 41,
          fp_rank_pos: 20,
          sleeper_adp: 41,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 41,
      userSlot: 1,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.recommendations[0]?.player_id).toBe("wr2");
    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.label))
      .toContain("Wait for ECR");
    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.label))
      .toContain("Wait for ECR");
  });

  it("penalizes non-elite QB before the early-QB window", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Useful Early QB",
          position: "QB",
          tier_rank: 25,
          tier_level: 4,
          fp_value: 75,
          fp_rank_pos: 7,
          sleeper_adp: 28,
        },
        {
          player_id: "wr1",
          name: "Starter WR",
          position: "WR",
          tier_rank: 28,
          tier_level: 4,
          fp_value: 55,
          fp_rank_pos: 14,
          sleeper_adp: 29,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 25,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("QB_TOO_EARLY");
    expect(board.metricsByPlayerId.qb1?.components.onesie ?? 0)
      .toBeLessThan(0);
    expect(board.recommendations[0]?.player_id).toBe("wr1");
  });

  it("penalizes non-elite TE before the round-six deadline", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "te1",
          name: "Useful Early TE",
          position: "TE",
          tier_rank: 42,
          tier_level: 6,
          fp_value: 48,
          fp_rank_pos: 7,
          sleeper_adp: 45,
        },
        {
          player_id: "rb3",
          name: "Flex RB",
          position: "RB",
          tier_rank: 44,
          tier_level: 6,
          fp_value: 46,
          fp_rank_pos: 22,
          sleeper_adp: 45,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 45,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("NON_ELITE_TE_TOO_EARLY");
    expect(board.metricsByPlayerId.te1?.components.onesie ?? 0)
      .toBeLessThan(0);
    expect(board.recommendations[0]?.player_id).toBe("rb3");
  });

  it("fills a close QB or TE starter before a third RB/WR once RB and WR starters are set", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr3",
          name: "Flex WR",
          position: "WR",
          tier_rank: 55,
          tier_level: 6,
          fp_value: 48,
          fp_rank_pos: 28,
          sleeper_adp: 58,
        },
        {
          player_id: "qb1",
          name: "Top Six QB",
          position: "QB",
          tier_rank: 57,
          tier_level: 6,
          fp_value: 45,
          fp_rank_pos: 5,
          sleeper_adp: 59,
        },
        {
          player_id: "te1",
          name: "Starter TE",
          position: "TE",
          tier_rank: 59,
          tier_level: 7,
          fp_value: 43,
          fp_rank_pos: 6,
          sleeper_adp: 60,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 59,
      userSlot: 10,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.recommendations[0]?.position).toMatch(/QB|TE/);
    const topPlayerId = board.recommendations[0]?.player_id;
    if (!topPlayerId) {
      throw new Error("Expected a top recommendation");
    }
    expect(board.metricsByPlayerId.wr3?.recommendationScore ?? 0)
      .toBeLessThan(board.metricsByPlayerId[topPlayerId]?.recommendationScore ?? 0);
  });

  it("treats round six as the TE starter deadline after RB and WR starters are set", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb3",
          name: "Flex RB",
          position: "RB",
          tier_rank: 58,
          tier_level: 8,
          fp_value: 50,
          sleeper_adp: 59,
        },
        {
          player_id: "te1",
          name: "Starter TE",
          position: "TE",
          tier_rank: 62,
          tier_level: 9,
          fp_value: 36,
          fp_rank_pos: 8,
          sleeper_adp: 62,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 61,
      userSlot: 1,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("STARTER_DEADLINE");
    expect(board.recommendations[0]?.player_id).toBe("te1");
  });

  it("takes a round-seven TE starter over close WR bench depth", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr4",
          name: "Bench WR",
          position: "WR",
          tier_rank: 72,
          tier_level: 9,
          fp_rank_ave: 72.4,
          fp_rank_pos: 31,
          sleeper_adp: 72,
        },
        {
          player_id: "te1",
          name: "Round Seven TE",
          position: "TE",
          tier_rank: 79,
          tier_level: 10,
          fp_rank_ave: 78.6,
          fp_rank_pos: 8,
          sleeper_adp: 79,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 70,
      userSlot: 10,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 3, QB: 1, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 0,
        TE: 1,
        K: 1,
        DEF: 1,
        BN: 4,
      },
    });

    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("STARTER_DEADLINE");
    expect(board.recommendations[0]?.player_id).toBe("te1");
  });

  it("waits on non-elite TE until the round six starter deadline", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr3",
          name: "Flex WR",
          position: "WR",
          tier_rank: 54,
          tier_level: 8,
          fp_value: 44,
          fp_rank_pos: 28,
          sleeper_adp: 54,
        },
        {
          player_id: "te1",
          name: "Round Five TE",
          position: "TE",
          tier_rank: 52,
          tier_level: 8,
          fp_value: 42,
          fp_rank_pos: 5,
          sleeper_adp: 52,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 50,
      userSlot: 10,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("ONESIE_WAIT");
    expect(board.recommendations[0]?.player_id).toBe("wr3");
  });

  it("treats round eight as the QB starter deadline when QB is not a pre-ADP reach", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr4",
          name: "Bench WR",
          position: "WR",
          tier_rank: 78,
          tier_level: 10,
          fp_value: 42,
          fp_rank_pos: 40,
          sleeper_adp: 82,
        },
        {
          player_id: "qb1",
          name: "Starter QB",
          position: "QB",
          tier_rank: 80,
          tier_level: 10,
          fp_value: 32,
          fp_rank_pos: 9,
          sleeper_adp: 79,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 81,
      userSlot: 1,
      rosterRequirements,
      userPositionCounts: { RB: 3, WR: 3, QB: 0, TE: 1, K: 0, DEF: 0, BN: 1 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 1,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 5,
      },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("STARTER_DEADLINE");
    expect(board.recommendations[0]?.player_id).toBe("qb1");
  });

  it("does not treat a viable QB inside the near-ADP window as a reach", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Near ADP QB",
          position: "QB",
          tier_rank: 84,
          tier_level: 10,
          fp_rank_ave: 84,
          fp_rank_pos: 8,
          sleeper_adp: 86,
        },
        {
          player_id: "rb1",
          name: "Bench RB",
          position: "RB",
          tier_rank: 82,
          tier_level: 10,
          fp_rank_ave: 82,
          fp_rank_pos: 30,
          sleeper_adp: 82,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 83,
      userSlot: 3,
      rosterRequirements,
      userPositionCounts: { RB: 4, WR: 4, QB: 0, TE: 1, K: 0, DEF: 0, BN: 3 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 1,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 3,
      },
    });

    const qbReasonCodes = board.metricsByPlayerId.qb1?.reasons.map(
      (reason) => reason.code
    );
    expect(qbReasonCodes).toContain("STARTER_DEADLINE");
    expect(qbReasonCodes).not.toContain("ONESIE_WAIT");
    expect(board.metricsByPlayerId.qb1?.components.onesie ?? 0)
      .toBeGreaterThan(0);
    expect(board.recommendations[0]?.player_id).toBe("qb1");
  });

  it("pulls a viable QB starter forward before the usable tier disappears", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Viable QB",
          position: "QB",
          tier_rank: 78,
          tier_level: 10,
          fp_value: 24,
          fp_rank_pos: 10,
          sleeper_adp: 78,
        },
        {
          player_id: "rb5",
          name: "Useful Bench RB",
          position: "RB",
          tier_rank: 82,
          tier_level: 10,
          fp_value: 39,
          sleeper_adp: 82,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 78,
      userSlot: 8,
      rosterRequirements,
      userPositionCounts: { RB: 3, WR: 2, QB: 0, TE: 1, K: 0, DEF: 0, BN: 1 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 1,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 4,
      },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("QB_VIABLE_STARTER");
    expect(board.metricsByPlayerId.qb1?.components.onesie ?? 0)
      .toBeGreaterThan(0);
    expect(board.recommendations[0]?.player_id).toBe("qb1");
  });

  it("pulls a top-ten QB forward once core RB/WR/TE starters are stable", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Top Ten QB",
          position: "QB",
          tier_rank: 76,
          tier_level: 10,
          fp_rank_ave: 76,
          fp_rank_pos: 9,
          sleeper_adp: 76,
        },
        {
          player_id: "wr4",
          name: "Useful Bench WR",
          position: "WR",
          tier_rank: 74,
          tier_level: 10,
          fp_rank_ave: 74,
          fp_rank_pos: 30,
          sleeper_adp: 76,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 73,
      userSlot: 3,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 3, QB: 0, TE: 1, K: 0, DEF: 0, BN: 1 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 1,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 5,
      },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("QB_VIABLE_STARTER");
    expect(board.metricsByPlayerId.qb1?.components.onesie ?? 0)
      .toBeGreaterThan(20);
    expect(board.recommendations[0]?.player_id).toBe("qb1");
  });

  it("does not panic-draft a low-ceiling QB in round ten over useful depth", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Low Ceiling QB",
          position: "QB",
          tier_rank: 96,
          tier_level: 12,
          fp_value: -48,
          fp_rank_pos: 24,
          sleeper_adp: 90,
        },
        {
          player_id: "wr5",
          name: "Useful Bench WR",
          position: "WR",
          tier_rank: 98,
          tier_level: 12,
          fp_value: 30,
          sleeper_adp: 105,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 96,
      userSlot: 6,
      rosterRequirements,
      userPositionCounts: { RB: 4, WR: 4, QB: 0, TE: 1, K: 0, DEF: 0, BN: 5 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 1,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 2,
      },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("QB_LOW_CEILING");
    expect(board.metricsByPlayerId.qb1?.components.onesie ?? 0)
      .toBeLessThan(0);
    expect(board.recommendations[0]?.player_id).toBe("wr5");
  });

  it("does not recommend a pre-ADP QB reach over an elite TE window", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Elite QB Before ADP",
          position: "QB",
          tier_rank: 22,
          tier_level: 4,
          position_tier_level: 1,
          fp_value: 120,
          fp_rank_pos: 1,
          sleeper_adp: 36,
        },
        {
          player_id: "te1",
          name: "Elite TE At Window",
          position: "TE",
          tier_rank: 15,
          tier_level: 3,
          position_tier_level: 1,
          fp_value: 90,
          fp_rank_pos: 1,
          sleeper_adp: 30.2,
        },
        {
          player_id: "wr1",
          name: "Starter WR",
          position: "WR",
          tier_rank: 18,
          tier_level: 3,
          fp_value: 88,
          fp_rank_pos: 12,
          sleeper_adp: 26.7,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 26,
      userSlot: 6,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .not.toContain("ELITE_QB_STARTER");
    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("ONESIE_WAIT");
    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_TE_STARTER");
    expect(board.recommendations[0]?.player_id).not.toBe("qb1");
    expect(board.metricsByPlayerId.te1?.recommendationScore ?? 0)
      .toBeGreaterThan(board.metricsByPlayerId.qb1?.recommendationScore ?? 0);
  });

  it("prefers an elite TE window over an elite QB when both onesie starters are live", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Elite QB",
          position: "QB",
          tier_rank: 34,
          tier_level: 2,
          position_tier_level: 1,
          fp_value: 95,
          fp_rank_pos: 1,
          sleeper_adp: 34,
        },
        {
          player_id: "te1",
          name: "Elite TE",
          position: "TE",
          tier_rank: 36,
          tier_level: 2,
          position_tier_level: 1,
          fp_value: 64,
          fp_rank_pos: 1,
          sleeper_adp: 35,
        },
        {
          player_id: "wr1",
          name: "Starter WR",
          position: "WR",
          tier_rank: 38,
          tier_level: 4,
          fp_value: 34,
          fp_rank_pos: 18,
          sleeper_adp: 40,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 36,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 3, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 2, FLEX: 0, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_QB_STARTER");
    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_TE_STARTER");
    expect(board.recommendations[0]?.player_id).toBe("te1");
  });

  it("lets elite TE beat a close WR2 in the round-three cliff window", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr1",
          name: "Close Starter WR",
          position: "WR",
          tier_rank: 25,
          tier_level: 4,
          fp_value: 68,
          fp_rank_pos: 14,
          sleeper_adp: 28,
        },
        {
          player_id: "te1",
          name: "Elite TE",
          position: "TE",
          tier_rank: 27,
          tier_level: 2,
          position_tier_level: 1,
          fp_value: 60,
          fp_rank_pos: 1,
          sleeper_adp: 28,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 27,
      userSlot: 7,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_TE_STARTER");
    expect(board.metricsByPlayerId.wr1?.reasons.map((reason) => reason.code))
      .toContain("WR2_ANCHOR");
    expect(board.recommendations[0]?.player_id).toBe("te1");
    expect(board.topRecommendation?.challengers[0]?.playerId).toBe("wr1");
  });

  it("takes an elite TE over a coin-flip RB2 after one RB and one WR", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb2",
          name: "Close RB2",
          position: "RB",
          tier_rank: 28,
          tier_level: 5,
          fp_value: 72,
          fp_rank_pos: 13,
          sleeper_adp: 29,
        },
        {
          player_id: "te1",
          name: "Elite TE",
          position: "TE",
          tier_rank: 27,
          tier_level: 3,
          position_tier_level: 1,
          fp_value: 60,
          fp_rank_pos: 1,
          sleeper_adp: 28,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 27,
      userSlot: 7,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.te1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_TE_STARTER");
    expect(board.recommendations[0]?.player_id).toBe("te1");
  });

  it("takes the first RB over an elite TE after opening WR/WR", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb1",
          name: "First RB Anchor",
          position: "RB",
          tier_rank: 33,
          tier_level: 4,
          fp_rank_ave: 33.4,
          fp_rank_pos: 14,
          sleeper_adp: 37,
        },
        {
          player_id: "te1",
          name: "Elite TE",
          position: "TE",
          tier_rank: 27,
          tier_level: 2,
          position_tier_level: 1,
          fp_rank_ave: 27.2,
          fp_rank_pos: 1,
          sleeper_adp: 29,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 25,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 0, WR: 2, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 2, WR: 0, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.rb1?.reasons.map((reason) => reason.code))
      .toContain("RB_ANCHOR");
    expect(board.metricsByPlayerId.rb1?.components.construction ?? 0)
      .toBeGreaterThan(0);
    expect(board.metricsByPlayerId.te1?.components.construction ?? 0)
      .toBeLessThan(0);
    expect(board.metricsByPlayerId.rb1?.recommendationExplanation.pros)
      .toContain("Fills first RB after WR-heavy start.");
    expect(board.metricsByPlayerId.te1?.recommendationExplanation.cons)
      .toContain("RB starter is still empty.");
    expect(board.recommendations[0]?.player_id).toBe("rb1");
  });

  it("uses a close round-two RB as the anchor after opening WR", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr2",
          name: "Second WR",
          position: "WR",
          tier_rank: 17,
          tier_level: 2,
          fp_rank_ave: 16.8,
          fp_rank_pos: 5,
          sleeper_adp: 17,
        },
        {
          player_id: "rb1",
          name: "First RB Anchor",
          position: "RB",
          tier_rank: 20,
          tier_level: 2,
          fp_rank_ave: 20.2,
          fp_rank_pos: 9,
          sleeper_adp: 20,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 16,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 0, WR: 1, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 2, WR: 1, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.rb1?.reasons.map((reason) => reason.code))
      .toContain("RB_ANCHOR");
    expect(board.metricsByPlayerId.rb1?.recommendationExplanation.pros)
      .toContain("Fills first RB after opening WR.");
    expect(board.metricsByPlayerId.wr2?.recommendationExplanation.cons)
      .toContain("RB starter is still empty.");
    expect(board.recommendations[0]?.player_id).toBe("rb1");
  });

  it("uses a close RB2 as the anchor after a WR/RB/WR start", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr3",
          name: "Third WR",
          position: "WR",
          tier_rank: 39,
          tier_level: 4,
          fp_rank_ave: 38.6,
          fp_rank_pos: 16,
          sleeper_adp: 40,
        },
        {
          player_id: "rb2",
          name: "Second RB Anchor",
          position: "RB",
          tier_rank: 43,
          tier_level: 4,
          fp_rank_ave: 42.9,
          fp_rank_pos: 18,
          sleeper_adp: 43,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 36,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 2, QB: 0, TE: 1, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 0, FLEX: 1, QB: 1, TE: 0, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.rb2?.reasons.map((reason) => reason.label))
      .toContain("RB2 anchor");
    expect(board.metricsByPlayerId.rb2?.components.construction ?? 0)
      .toBeGreaterThan(0);
    expect(board.metricsByPlayerId.wr3?.components.construction ?? 0)
      .toBeLessThan(0);
    expect(board.metricsByPlayerId.rb2?.recommendationExplanation.pros)
      .toContain("Fills RB2 before the starter tier gets thin.");
    expect(board.metricsByPlayerId.wr3?.recommendationExplanation.cons)
      .toContain("RB2 is still empty.");
    expect(board.recommendations[0]?.player_id).toBe("rb2");
  });

  it("uses RB2 in round four after starting RB WR and TE", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr2",
          name: "Second WR",
          position: "WR",
          tier_rank: 36,
          tier_level: 5,
          fp_rank_ave: 36.2,
          fp_rank_pos: 16,
          sleeper_adp: 36,
        },
        {
          player_id: "rb2",
          name: "Second RB Anchor",
          position: "RB",
          tier_rank: 42,
          tier_level: 5,
          fp_rank_ave: 42.1,
          fp_rank_pos: 19,
          sleeper_adp: 42,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 38,
      userSlot: 3,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 1, QB: 0, TE: 1, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 1, FLEX: 1, QB: 1, TE: 0, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.rb2?.reasons.map((reason) => reason.label))
      .toContain("RB2 anchor");
    expect(board.metricsByPlayerId.rb2?.recommendationExplanation.pros)
      .toContain("Fills RB2 before the starter tier gets thin.");
    expect(board.metricsByPlayerId.wr2?.recommendationExplanation.cons)
      .toContain("RB2 is still empty.");
    expect(board.recommendations[0]?.player_id).toBe("rb2");
  });

  it("takes a close RB2 before a tier-one QB in the round-five window", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Elite QB Window",
          position: "QB",
          tier_rank: 42,
          tier_level: 5,
          position_tier_level: 1,
          fp_rank_ave: 42.2,
          fp_rank_pos: 2,
          sleeper_adp: 45,
        },
        {
          player_id: "rb2",
          name: "Second RB Option",
          position: "RB",
          tier_rank: 54,
          tier_level: 5,
          fp_rank_ave: 54.4,
          fp_rank_pos: 23,
          sleeper_adp: 48,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 45,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 2, QB: 0, TE: 1, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 0, FLEX: 1, QB: 1, TE: 0, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_QB_STARTER");
    expect(board.metricsByPlayerId.rb2?.reasons.map((reason) => reason.label))
      .toContain("RB2 anchor");
    expect(board.recommendations[0]?.player_id).toBe("rb2");
  });

  it("takes a close WR2 before a tier-one QB in the round-five window", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Elite QB Window",
          position: "QB",
          tier_rank: 42,
          tier_level: 5,
          position_tier_level: 1,
          fp_rank_ave: 42.2,
          fp_rank_pos: 3,
          sleeper_adp: 45,
        },
        {
          player_id: "wr2",
          name: "Second WR Option",
          position: "WR",
          tier_rank: 58,
          tier_level: 5,
          fp_rank_ave: 54.4,
          fp_rank_pos: 22,
          sleeper_adp: 48,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 45,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 1, QB: 0, TE: 1, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 1, FLEX: 1, QB: 1, TE: 0, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("ELITE_QB_STARTER");
    expect(board.metricsByPlayerId.wr2?.reasons.map((reason) => reason.label))
      .toContain("WR2 anchor");
    expect(board.recommendations[0]?.player_id).toBe("wr2");
  });

  it("takes a viable late QB starter over WR depth when the QB is only one round early", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr5",
          name: "WR Depth",
          position: "WR",
          tier_rank: 92,
          tier_level: 8,
          fp_rank_ave: 91.8,
          fp_rank_pos: 28,
          sleeper_adp: 72,
        },
        {
          player_id: "qb1",
          name: "Viable QB Starter",
          position: "QB",
          tier_rank: 88,
          tier_level: 11,
          fp_rank_ave: 87.6,
          fp_rank_pos: 9,
          sleeper_adp: 100,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 91,
      userSlot: 4,
      rosterRequirements,
      userPositionCounts: { RB: 3, WR: 4, QB: 0, TE: 1, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 0, QB: 1, TE: 0, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.qb1?.components.onesie ?? 0)
      .toBeGreaterThan(0);
    expect(board.metricsByPlayerId.qb1?.recommendationExplanation.pros)
      .toContain("You need to fill QB.");
    expect(board.recommendations[0]?.player_id).toBe("qb1");
  });

  it("raises late QB starter urgency before kicker or extra depth", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Usable Late QB",
          position: "QB",
          tier_rank: 120,
          tier_level: 12,
          fp_value: 48,
          fp_rank_pos: 11,
          sleeper_adp: 122,
        },
        {
          player_id: "rb1",
          name: "Extra Bench RB",
          position: "RB",
          tier_rank: 118,
          tier_level: 12,
          fp_value: 65,
          sleeper_adp: 126,
        },
        {
          player_id: "k1",
          name: "Early Kicker",
          position: "K",
          tier_rank: 125,
          tier_level: 12,
          fp_value: 90,
          sleeper_adp: 145,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 126,
      userSlot: 6,
      rosterRequirements,
      userPositionCounts: { RB: 6, WR: 4, QB: 0, TE: 1, K: 0, DEF: 0, BN: 5 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 1,
        TE: 0,
        K: 1,
        DEF: 1,
        BN: 1,
      },
    });

    expect(board.metricsByPlayerId.qb1?.reasons.map((reason) => reason.code))
      .toContain("QB_TIMING");
    expect(board.recommendations[0]?.player_id).toBe("qb1");
  });

  it("raises the WR starter window before accepting non-elite QB or RB depth", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb1",
          name: "Useful QB",
          position: "QB",
          tier_rank: 50,
          tier_level: 8,
          fp_pts: 330,
          fp_value: 34,
          sleeper_adp: 68,
        },
        {
          player_id: "wr3",
          name: "Starter Window WR",
          position: "WR",
          tier_rank: 46,
          tier_level: 7,
          fp_pts: 230,
          fp_value: 30,
          fp_rank_pos: 28,
          sleeper_adp: 47,
        },
        {
          player_id: "rb3",
          name: "RB Depth",
          position: "RB",
          tier_rank: 76,
          tier_level: 12,
          fp_pts: 200,
          fp_value: 32,
          sleeper_adp: 65,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 59,
      userSlot: 2,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 0, TE: 1, K: 0, DEF: 0, BN: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 1, QB: 1, TE: 0, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.wr3?.reasons.map((reason) => reason.code))
      .toContain("WR_STARTER_WINDOW");
    expect(board.recommendations[0]?.player_id).toBe("wr3");
  });

  it("distinguishes the second WR anchor from later WR depth", () => {
    const players = [
      {
        player_id: "wr2",
        name: "Second Anchor WR",
        position: "WR",
        tier_rank: 42,
        tier_level: 7,
        fp_pts: 230,
        fp_value: 24,
        fp_rank_pos: 20,
        sleeper_adp: 43,
      },
      {
        player_id: "qb1",
        name: "Good QB",
        position: "QB",
        tier_rank: 40,
        tier_level: 6,
        fp_pts: 335,
        fp_value: 34,
        sleeper_adp: 49,
      },
    ] as const;
    const anchorBoard = buildDraftValueBoard({
      players,
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 44,
      userSlot: 4,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 1, QB: 0, TE: 1, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 1, FLEX: 1, QB: 1, TE: 0, K: 1, DEF: 1 },
    });

    expect(anchorBoard.metricsByPlayerId.wr2?.reasons.map((reason) => reason.code))
      .toContain("WR2_ANCHOR");
    expect(
      anchorBoard.metricsByPlayerId.wr2?.reasons
        .slice(0, 2)
        .map((reason) => reason.code)
    ).toContain("WR2_ANCHOR");

    const depthBoard = buildDraftValueBoard({
      players,
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 64,
      userSlot: 4,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 3, QB: 0, TE: 1, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 0, QB: 1, TE: 0, K: 1, DEF: 1 },
    });

    expect(depthBoard.metricsByPlayerId.wr2?.reasons.map((reason) => reason.code))
      .not.toContain("WR2_ANCHOR");
  });

  it("uses the first WR anchor as an early tie-breaker against another RB", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb2",
          name: "Close RB2",
          position: "RB",
          tier_rank: 16,
          tier_level: 3,
          fp_value: 61,
          sleeper_adp: 18,
        },
        {
          player_id: "wr1",
          name: "First WR Anchor",
          position: "WR",
          tier_rank: 18,
          tier_level: 3,
          fp_value: 58,
          fp_rank_pos: 8,
          sleeper_adp: 19,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 16,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 1, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 2, FLEX: 1, QB: 1, TE: 1, K: 1, DEF: 1 },
    });

    expect(board.metricsByPlayerId.wr1?.reasons.map((reason) => reason.code))
      .toContain("WR_STARTER_WINDOW");
    expect(board.recommendations[0]?.player_id).toBe("wr1");
  });

  it("treats Sleeper placeholder ADP as missing draft timing data", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "def1",
          name: "Placeholder ADP Defense",
          position: "DEF",
          tier_rank: 1,
          tier_level: 1,
          fp_pts: 120,
          sleeper_adp: 999,
        },
      ],
      teams: 10,
      rounds: 15,
      draftType: "snake",
      currentPick: 141,
      userSlot: 1,
      rosterRequirements,
      userPositionCounts: { RB: 2, WR: 2, QB: 1, TE: 1, K: 1, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 0, QB: 0, TE: 0, K: 0, DEF: 1 },
    });

    expect(board.metricsByPlayerId.def1?.sleeperAdp).toBeNull();
    expect(board.metricsByPlayerId.def1?.adpDeltaRounds).toBeNull();
    expect(board.metricsByPlayerId.def1?.comebackProbability).toBeNull();
    expect(board.metricsByPlayerId.def1?.comebackLabel).toBe("unknown");
  });
});
