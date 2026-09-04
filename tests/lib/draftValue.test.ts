import { describe, expect, it } from "vitest";
import {
  attachDraftValueMetrics,
  buildDraftValueBoard as buildProductionDraftValueBoard,
  type DraftValueBoardInput,
  type DraftValuePlayerInput,
} from "@/lib/draftValue";

function buildDraftValueBoard<TPlayer extends DraftValuePlayerInput>(
  input: Omit<DraftValueBoardInput<TPlayer>, "staticValuesByPlayerId"> & {
    staticValuesByPlayerId?: Readonly<Record<string, number>>;
  }
) {
  const players = input.players.map((player, index) => ({
    ...player,
    fp_rank_ave:
      player.fp_rank_ave ?? player.tier_rank ?? player.rank ?? index + 1,
    fp_rank_pos: player.fp_rank_pos ?? index + 1,
    position_tier_level:
      player.position_tier_level ?? player.tier_level ?? player.tier ?? 1,
  }));
  const staticValuesByPlayerId = input.staticValuesByPlayerId ??
    Object.fromEntries(
      players.map((player) => [player.player_id, 200 - (player.fp_rank_ave ?? 200)])
    );
  return buildProductionDraftValueBoard({
    ...input,
    players,
    staticValuesByPlayerId,
  });
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

  it("keeps Val static while roster state changes Adj", () => {
    const base = {
      players: [
        { player_id: "rb1", name: "Runner", position: "RB", tier_rank: 4, tier_level: 1 },
        { player_id: "wr1", name: "Receiver", position: "WR", tier_rank: 5, tier_level: 1 },
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      userSlot: 4,
      rosterRequirements,
      staticValuesByPlayerId: { rb1: 42, wr1: 40 },
    } as const;
    const early = buildDraftValueBoard({
      ...base,
      currentPick: 4,
      userPositionCounts: {},
      userPositionNeeds: { RB: 2, WR: 2, FLEX: 1 },
    });
    const later = buildDraftValueBoard({
      ...base,
      currentPick: 52,
      userPositionCounts: { RB: 3, WR: 0 },
      userPositionNeeds: { RB: 0, WR: 2, FLEX: 1 },
    });
    expect(early.metricsByPlayerId.rb1?.staticValue).toBe(42);
    expect(later.metricsByPlayerId.rb1?.staticValue).toBe(42);
    expect(later.metricsByPlayerId.rb1?.recommendationScore).not.toBe(
      early.metricsByPlayerId.rb1?.recommendationScore
    );
  });

  it("preserves the raw Beer+ gap when it builds the adjusted value score", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr1",
          name: "Best Raw Value",
          position: "WR",
          tier_rank: 1,
          tier_level: 1,
          fp_rank_pos: 1,
          sleeper_adp: 1,
        },
        {
          player_id: "rb1",
          name: "Lower Raw Value",
          position: "RB",
          tier_rank: 4,
          tier_level: 2,
          fp_rank_pos: 2,
          sleeper_adp: 4,
        },
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      currentPick: 4,
      userSlot: 4,
      rosterRequirements,
      userPositionCounts: {},
      userPositionNeeds: {
        RB: 2,
        WR: 2,
        FLEX: 1,
        QB: 1,
        TE: 1,
        K: 1,
        DEF: 1,
      },
      staticValuesByPlayerId: { wr1: 122.4, rb1: 109.6 },
    });

    expect(board.metricsByPlayerId.wr1?.rawScores.value).toBe(100);
    expect(board.metricsByPlayerId.rb1?.rawScores.value).toBe(87.2);
    expect(board.recommendations[0]?.player_id).toBe("wr1");
  });

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

  it("does not recommend special-team positions beyond configured starters", () => {
    const board = buildDraftValueBoard({
      players: [
        { player_id: "k1", name: "Kicker", position: "K", tier_rank: 1, tier_level: 1 },
        { player_id: "def1", name: "Defense", position: "DEF", tier_rank: 2, tier_level: 1 },
        { player_id: "wr1", name: "Wideout", position: "WR", tier_rank: 3, tier_level: 1 },
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      currentPick: 168,
      userSlot: 4,
      rosterRequirements: { ...rosterRequirements, K: 0, DEF: 1, BN: 5 },
      userPositionCounts: { K: 0, DEF: 1, WR: 4 },
      userPositionNeeds: { K: 0, DEF: 0, BN: 1 },
    });

    expect(board.recommendations.map((player) => player.player_id)).toEqual(["wr1"]);
  });

  it("keeps DEF out of the pool until the final two rounds", () => {
      const base = {
        players: [
          {
            player_id: "def1",
            name: "Top Defense",
            position: "DEF",
            fp_rank_ave: 150,
            fp_rank_pos: 1,
            sleeper_adp: 140,
          },
          {
            player_id: "wr1",
            name: "Bench Receiver",
            position: "WR",
            fp_rank_ave: 151,
            fp_rank_pos: 60,
            sleeper_adp: 141,
          },
        ],
        teams: 12,
        rounds: 14,
        draftType: "snake",
        userSlot: 4,
        rosterRequirements: { ...rosterRequirements, K: 0, DEF: 1, BN: 5 },
        userPositionCounts: { QB: 1, RB: 4, WR: 4, TE: 1, DEF: 0 },
        userPositionNeeds: { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, K: 0, DEF: 1, BN: 3 },
        staticValuesByPlayerId: { def1: 200, wr1: 0 },
      } as const;

      const roundTen = buildDraftValueBoard({ ...base, currentPick: 110 });
      const roundThirteen = buildDraftValueBoard({ ...base, currentPick: 150 });

      expect(roundTen.recommendations.map((player) => player.player_id)).toEqual(["wr1"]);
      expect(roundThirteen.recommendations.map((player) => player.player_id)).toContain("def1");
  });

  it("keeps K out of the pool until the final two rounds", () => {
      const base = {
        players: [
          {
            player_id: "k1",
            name: "Top Kicker",
            position: "K",
            fp_rank_ave: 150,
            fp_rank_pos: 1,
            sleeper_adp: 140,
          },
          {
            player_id: "rb1",
            name: "Bench Runner",
            position: "RB",
            fp_rank_ave: 151,
            fp_rank_pos: 60,
            sleeper_adp: 141,
          },
        ],
        teams: 12,
        rounds: 15,
        draftType: "snake",
        userSlot: 4,
        rosterRequirements: { ...rosterRequirements, K: 1, DEF: 1, BN: 6 },
        userPositionCounts: { QB: 1, RB: 4, WR: 4, TE: 1, K: 0, DEF: 1 },
        userPositionNeeds: { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, K: 1, DEF: 0, BN: 3 },
        staticValuesByPlayerId: { k1: 200, rb1: 0 },
      } as const;

      const roundTwelve = buildDraftValueBoard({ ...base, currentPick: 140 });
      const roundFourteen = buildDraftValueBoard({ ...base, currentPick: 160 });

      expect(roundTwelve.recommendations.map((player) => player.player_id)).toEqual(["rb1"]);
      expect(roundFourteen.recommendations.map((player) => player.player_id)).toContain("k1");
  });

  it("fills a required special-team slot when no other capacity remains", () => {
      const board = buildDraftValueBoard({
        players: [
          {
            player_id: "def1",
            name: "Required Defense",
            position: "DEF",
            fp_rank_ave: 150,
            fp_rank_pos: 1,
            sleeper_adp: 140,
          },
        ],
        teams: 12,
        rounds: 14,
        draftType: "snake",
        currentPick: 110,
        userSlot: 4,
        rosterRequirements: { ...rosterRequirements, K: 0, DEF: 1, BN: 5 },
        userPositionCounts: { QB: 1, RB: 5, WR: 5, TE: 1, DEF: 0, BN: 5 },
        userPositionNeeds: { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, K: 0, DEF: 1, BN: 0 },
        staticValuesByPlayerId: { def1: 200 },
      });

      expect(board.recommendations.map((player) => player.player_id)).toEqual(["def1"]);
  });

  it("hard-excludes a second QB, TE, K, or DEF", () => {
      const board = buildDraftValueBoard({
        players: [
          {
            player_id: "qb2",
            name: "Second Quarterback",
            position: "QB",
            fp_rank_ave: 1,
            fp_rank_pos: 1,
          },
          {
            player_id: "te2",
            name: "Second Tight End",
            position: "TE",
            fp_rank_ave: 2,
            fp_rank_pos: 1,
          },
          {
            player_id: "k2",
            name: "Second Kicker",
            position: "K",
            fp_rank_ave: 3,
            fp_rank_pos: 1,
          },
          {
            player_id: "def2",
            name: "Second Defense",
            position: "DEF",
            fp_rank_ave: 4,
            fp_rank_pos: 1,
          },
          {
            player_id: "wr5",
            name: "Bench Receiver",
            position: "WR",
            fp_rank_ave: 100,
            fp_rank_pos: 50,
          },
        ],
        teams: 12,
        rounds: 15,
        draftType: "snake",
        currentPick: 160,
        userSlot: 4,
        rosterRequirements,
        userPositionCounts: {
          QB: 1,
          RB: 3,
          WR: 3,
          TE: 1,
          K: 1,
          DEF: 1,
        },
        userPositionNeeds: {
          QB: 0,
          RB: 0,
          WR: 0,
          TE: 0,
          FLEX: 0,
          K: 0,
          DEF: 0,
          BN: 4,
        },
        staticValuesByPlayerId: {
          qb2: 500,
          te2: 400,
          k2: 300,
          def2: 200,
          wr5: 1,
        },
      });

      expect(board.recommendations.map((player) => player.player_id)).toEqual([
        "wr5",
      ]);
  });

  it("reserves the final picks for unfinished RB/WR depth and required slots", () => {
      const board = buildDraftValueBoard({
        players: [
          {
            player_id: "rb7",
            name: "Extra RB",
            position: "RB",
            fp_rank_ave: 100,
            fp_rank_pos: 50,
            sleeper_adp: 100,
          },
          {
            player_id: "wr4",
            name: "Required WR Depth",
            position: "WR",
            fp_rank_ave: 150,
            fp_rank_pos: 70,
            sleeper_adp: 150,
          },
          {
            player_id: "def1",
            name: "Required Defense",
            position: "DEF",
            fp_rank_ave: 160,
            fp_rank_pos: 1,
            sleeper_adp: 160,
          },
        ],
        teams: 12,
        rounds: 14,
        draftType: "snake",
        currentPick: 133,
        userSlot: 1,
        rosterRequirements: {
          ...rosterRequirements,
          FLEX: 2,
          K: 0,
          DEF: 1,
          BN: 5,
        },
        userPositionCounts: {
          QB: 1,
          RB: 6,
          WR: 3,
          TE: 1,
          K: 0,
          DEF: 0,
        },
        userPositionNeeds: {
          QB: 0,
          RB: 0,
          WR: 0,
          TE: 0,
          FLEX: 0,
          K: 0,
          DEF: 1,
          BN: 2,
        },
        staticValuesByPlayerId: { rb7: 200, wr4: 0, def1: 100 },
      });

      expect(board.recommendations.map((player) => player.player_id)).toEqual([
        "wr4",
      ]);
  });

  it("exposes raw and adjusted values from one recommendation board", () => {
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
    expect(metrics?.topComponents[0]?.label).toBe("Starter-aware value");
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
    expect(attached.draft_raw_value_score).toBe(metrics.staticValue);
    expect(attached.draft_value_score).toBe(metrics.recommendationScore);
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

  it("preserves the starter-aware value gap instead of flattening it at the cap", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "tier-one-wr",
          name: "Tier One WR",
          position: "WR",
          tier_level: 1,
          position_tier_level: 1,
          fp_rank_ave: 3.2,
          fp_rank_pos: 2,
          sleeper_adp: 4.9,
        },
        {
          player_id: "tier-two-rb",
          name: "Tier Two RB",
          position: "RB",
          tier_level: 2,
          position_tier_level: 1,
          fp_rank_ave: 8.9,
          fp_rank_pos: 3,
          sleeper_adp: 6.7,
        },
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      currentPick: 5,
      userSlot: 5,
      rosterRequirements,
      userPositionCounts: { RB: 0, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: {
        RB: 2,
        WR: 2,
        FLEX: 1,
        QB: 1,
        TE: 1,
        K: 1,
        DEF: 1,
      },
      draftWideNeeds: { RB: 22, WR: 22 },
      staticValuesByPlayerId: {
        "tier-one-wr": 110,
        "tier-two-rb": 92,
      },
    });

    expect(board.metricsByPlayerId["tier-one-wr"]?.rawScores.value).toBe(100);
    expect(board.metricsByPlayerId["tier-two-rb"]?.rawScores.value).toBeLessThan(
      100
    );
    expect(board.recommendations[0]?.player_id).toBe("tier-one-wr");
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

  it("uses the supplied starter-aware values as the static baseline", () => {
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
      staticValuesByPlayerId: { rb1: 35, rb2: 20, rb3: 5, rb4: 0 },
    });

    const best = board.metricsByPlayerId.rb1;
    const worse = board.metricsByPlayerId.rb2;
    expect(board.recommendations[0]?.player_id).toBe("rb1");
    expect(best?.staticValue ?? 0).toBeGreaterThan(worse?.staticValue ?? 0);
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
      staticValuesByPlayerId: { missing: 100, ranked: 50 },
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

  it("adds player news risk without hiding usable value", () => {
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
    });

    const reasons = board.metricsByPlayerId.wr1?.reasons.map(
      (reason) => reason.code
    );
    expect(reasons).toContain("AVAILABILITY_RISK");
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

  it("does not let bench balance lift negative Beer+ value over a better tier", () => {
    const fillerDefenses = Array.from({ length: 180 }, (_, index) => ({
      player_id: `def-${index}`,
      name: `Defense ${index}`,
      position: "DEF" as const,
      tier_rank: 200 + index,
      tier_level: 20,
      position_tier_level: 10,
      fp_rank_ave: 200 + index,
      fp_rank_pos: index + 1,
      sleeper_adp: 200 + index,
    }));
    const staticValuesByPlayerId = Object.fromEntries([
      ["rb-depth", -2.3],
      ["wr-value", 25.2],
      ...fillerDefenses.map((player, index) => [player.player_id, -20 - index]),
    ]);
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "rb-depth",
          name: "Below Baseline RB",
          position: "RB",
          tier_rank: 98,
          tier_level: 12,
          position_tier_level: 8,
          fp_rank_ave: 98,
          fp_rank_pos: 34,
          sleeper_adp: 113,
        },
        {
          player_id: "wr-value",
          name: "Better Tier WR",
          position: "WR",
          tier_rank: 82,
          tier_level: 10,
          position_tier_level: 7,
          fp_rank_ave: 82,
          fp_rank_pos: 31,
          sleeper_adp: 105,
          sleeper_injury_status: "Questionable",
        },
        ...fillerDefenses,
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      currentPick: 100,
      userSlot: 4,
      rosterRequirements: { ...rosterRequirements, FLEX: 2, K: 0, BN: 5 },
      userPositionCounts: {
        RB: 2,
        WR: 4,
        QB: 1,
        TE: 1,
        K: 0,
        DEF: 0,
        BN: 0,
      },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 0,
        QB: 0,
        TE: 0,
        K: 0,
        DEF: 1,
        BN: 5,
      },
      staticValuesByPlayerId,
    });

    expect(board.metricsByPlayerId["rb-depth"]?.staticValue).toBeLessThan(0);
    expect(board.recommendations[0]?.player_id).toBe("wr-value");
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
      staticValuesByPlayerId: { wr4: -5, rb3: -6 },
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
      staticValuesByPlayerId: { rb1: 20, wr1: 19 },
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
      staticValuesByPlayerId: { qb2: -1, rb4: -5, k1: -10 },
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

  it("takes an acceptable TE when its starter tier will not reach the next turn", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "te5",
          name: "Acceptable Starter TE",
          position: "TE",
          tier_rank: 53,
          tier_level: 7,
          position_tier_level: 3,
          fp_rank_ave: 53,
          fp_rank_pos: 5,
          sleeper_adp: 54,
        },
        {
          player_id: "wr25",
          name: "Close FLEX WR",
          position: "WR",
          tier_rank: 52,
          tier_level: 7,
          position_tier_level: 6,
          fp_rank_ave: 52,
          fp_rank_pos: 25,
          sleeper_adp: 58,
        },
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      currentPick: 55,
      userSlot: 7,
      rosterRequirements: { ...rosterRequirements, FLEX: 2, K: 0, BN: 5 },
      userPositionCounts: { RB: 2, WR: 2, QB: 1, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 2, QB: 0, TE: 1, K: 0, DEF: 1 },
    });

    expect(board.metricsByPlayerId.te5?.comebackLabel).toBe("unlikely");
    expect(board.metricsByPlayerId.te5?.reasons.map((reason) => reason.code))
      .toContain("TE_QUALITY_WINDOW");
    expect(board.recommendations[0]?.player_id).toBe("te5");
  });

  it("takes the last acceptable TE over a small FLEX value edge before the turn", () => {
    const fillerDefenses = Array.from({ length: 180 }, (_, index) => ({
      player_id: `te-window-def-${index}`,
      name: `Defense ${index}`,
      position: "DEF" as const,
      tier_rank: 200 + index,
      tier_level: 20,
      position_tier_level: 10,
      fp_rank_ave: 200 + index,
      fp_rank_pos: index + 1,
      sleeper_adp: 200 + index,
    }));
    const staticValuesByPlayerId = Object.fromEntries([
      ["wr27", 55.5],
      ["te5", 36.9],
      ...fillerDefenses.map((player, index) => [
        player.player_id,
        -20 - index * 0.4,
      ]),
    ]);
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "wr27",
          name: "Close FLEX WR",
          position: "WR",
          tier_rank: 56,
          tier_level: 8,
          position_tier_level: 5,
          fp_rank_ave: 56,
          fp_rank_pos: 27,
          sleeper_adp: 69,
        },
        {
          player_id: "te5",
          name: "Last Acceptable TE",
          position: "TE",
          tier_rank: 76,
          tier_level: 12,
          position_tier_level: 3,
          fp_rank_ave: 76,
          fp_rank_pos: 5,
          sleeper_adp: 70,
        },
        ...fillerDefenses,
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      currentPick: 69,
      userSlot: 4,
      rosterRequirements: { ...rosterRequirements, FLEX: 2, K: 0, BN: 5 },
      userPositionCounts: { RB: 2, WR: 2, QB: 1, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: {
        RB: 0,
        WR: 0,
        FLEX: 2,
        QB: 0,
        TE: 1,
        K: 0,
        DEF: 1,
        BN: 5,
      },
      staticValuesByPlayerId,
    });

    expect(board.metricsByPlayerId.te5?.sameTierFallbackCount).toBe(0);
    expect(board.metricsByPlayerId.te5?.reasons.map((reason) => reason.code))
      .toContain("TE_QUALITY_WINDOW");
    expect(board.recommendations[0]?.player_id).toBe("te5");
  });

  it("uses position rank instead of raw Beer-style units for the TE quality window", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "te5",
          name: "Acceptable Starter TE",
          position: "TE",
          tier_rank: 53,
          tier_level: 7,
          position_tier_level: 3,
          fp_rank_ave: 53,
          fp_rank_pos: 5,
          sleeper_adp: 54,
        },
        {
          player_id: "wr25",
          name: "Close FLEX WR",
          position: "WR",
          tier_rank: 52,
          tier_level: 7,
          position_tier_level: 6,
          fp_rank_ave: 52,
          fp_rank_pos: 25,
          sleeper_adp: 58,
        },
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      currentPick: 55,
      userSlot: 7,
      rosterRequirements: { ...rosterRequirements, FLEX: 2, K: 0, BN: 5 },
      userPositionCounts: { RB: 2, WR: 2, QB: 1, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 2, QB: 0, TE: 1, K: 0, DEF: 1 },
      staticValuesByPlayerId: { te5: 35, wr25: 40 },
    });

    expect(board.metricsByPlayerId.te5?.reasons.map((reason) => reason.code))
      .toContain("TE_QUALITY_WINDOW");
  });

  it("flags elite QB at ADP and completes TE by round seven", () => {
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
          sleeper_adp: 66,
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

  it("penalizes non-elite TE before a quality starter window", () => {
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

  it("starts TE completion in round six after RB and WR starters are set", () => {
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

  it("takes the best remaining TE by round seven when the starter slot is open", () => {
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

  it("waits instead of reaching a full round for a non-elite TE", () => {
      const board = buildDraftValueBoard({
        players: [
          {
            player_id: "rb1",
            name: "Best Available RB",
            position: "RB",
            tier_rank: 76,
            tier_level: 9,
            fp_rank_ave: 76,
            fp_rank_pos: 30,
            sleeper_adp: 76,
          },
          {
            player_id: "te10",
            name: "Reach TE",
            position: "TE",
            tier_rank: 98,
            tier_level: 11,
            position_tier_level: 5,
            fp_rank_ave: 98,
            fp_rank_pos: 10,
            sleeper_adp: 90,
          },
        ],
        teams: 12,
        rounds: 14,
        draftType: "snake",
        currentPick: 75,
        userSlot: 3,
        rosterRequirements: { ...rosterRequirements, FLEX: 2, K: 0, BN: 5 },
        userPositionCounts: { RB: 2, WR: 2, QB: 1, TE: 0, K: 0, DEF: 0 },
        userPositionNeeds: {
          RB: 0,
          WR: 0,
          FLEX: 2,
          QB: 0,
          TE: 1,
          K: 0,
          DEF: 1,
          BN: 5,
        },
        staticValuesByPlayerId: { rb1: 100, te10: 35 },
      });

      expect(board.metricsByPlayerId.te10?.reasons.map((reason) => reason.code))
        .toContain("ONESIE_PRICE_REACH");
      expect(board.recommendations[0]?.player_id).toBe("rb1");
  });

  it("waits on non-elite TE before a quality starter window", () => {
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

  it("does not treat a top-ten QB as low ceiling because Beer-style Val is negative", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "qb10",
          name: "Top Ten QB",
          position: "QB",
          tier_rank: 96,
          tier_level: 8,
          position_tier_level: 4,
          fp_rank_ave: 96,
          fp_rank_pos: 10,
          sleeper_adp: 97,
        },
        {
          player_id: "wr50",
          name: "Bench WR",
          position: "WR",
          tier_rank: 98,
          tier_level: 9,
          position_tier_level: 8,
          fp_rank_ave: 98,
          fp_rank_pos: 50,
          sleeper_adp: 99,
        },
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      currentPick: 97,
      userSlot: 1,
      rosterRequirements: { ...rosterRequirements, FLEX: 2, K: 0, BN: 5 },
      userPositionCounts: { RB: 4, WR: 4, QB: 0, TE: 1, DEF: 0 },
      userPositionNeeds: { RB: 0, WR: 0, FLEX: 0, QB: 1, TE: 0, K: 0, DEF: 1, BN: 4 },
      staticValuesByPlayerId: { qb10: -5, wr50: -10 },
    });

    expect(board.metricsByPlayerId.qb10?.reasons.map((reason) => reason.code))
      .toContain("QB_VIABLE_STARTER");
    expect(board.metricsByPlayerId.qb10?.reasons.map((reason) => reason.code))
      .not.toContain("QB_LOW_CEILING");
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

  it("avoids a multi-round RB/WR bench reach when close value is near market price", () => {
      const board = buildDraftValueBoard({
        players: [
          {
            player_id: "early-rb",
            name: "Early Depth RB",
            position: "RB",
            tier_rank: 110,
            tier_level: 10,
            position_tier_level: 8,
            fp_rank_ave: 110,
            fp_rank_pos: 35,
            sleeper_adp: 160,
          },
          {
            player_id: "market-wr",
            name: "Market Depth WR",
            position: "WR",
            tier_rank: 112,
            tier_level: 10,
            position_tier_level: 8,
            fp_rank_ave: 112,
            fp_rank_pos: 40,
            sleeper_adp: 120,
          },
        ],
        teams: 12,
        rounds: 14,
        draftType: "snake",
        currentPick: 109,
        userSlot: 4,
        rosterRequirements: {
          ...rosterRequirements,
          FLEX: 2,
          K: 0,
          BN: 5,
        },
        userPositionCounts: { RB: 4, WR: 4, QB: 1, TE: 1, K: 0, DEF: 0 },
        userPositionNeeds: {
          RB: 0,
          WR: 0,
          FLEX: 0,
          QB: 0,
          TE: 0,
          K: 0,
          DEF: 1,
          BN: 4,
        },
        staticValuesByPlayerId: { "early-rb": 100, "market-wr": 96 },
      });

      expect(board.recommendations[0]?.player_id).toBe("market-wr");
  });

  it("lets a material RB/WR balance need override the depth price penalty", () => {
      const board = buildDraftValueBoard({
        players: [
          {
            player_id: "needed-wr",
            name: "Needed Depth WR",
            position: "WR",
            tier_rank: 110,
            tier_level: 10,
            position_tier_level: 8,
            fp_rank_ave: 110,
            fp_rank_pos: 35,
            sleeper_adp: 160,
          },
          {
            player_id: "extra-rb",
            name: "Extra Market RB",
            position: "RB",
            tier_rank: 112,
            tier_level: 10,
            position_tier_level: 8,
            fp_rank_ave: 112,
            fp_rank_pos: 40,
            sleeper_adp: 120,
          },
        ],
        teams: 12,
        rounds: 14,
        draftType: "snake",
        currentPick: 109,
        userSlot: 4,
        rosterRequirements: {
          ...rosterRequirements,
          FLEX: 2,
          K: 0,
          BN: 5,
        },
        userPositionCounts: { RB: 6, WR: 3, QB: 1, TE: 1, K: 0, DEF: 0 },
        userPositionNeeds: {
          RB: 0,
          WR: 0,
          FLEX: 0,
          QB: 0,
          TE: 0,
          K: 0,
          DEF: 1,
          BN: 3,
        },
        staticValuesByPlayerId: { "needed-wr": 100, "extra-rb": 96 },
      });

      expect(board.recommendations[0]?.player_id).toBe("needed-wr");
      expect(
        board.metricsByPlayerId["needed-wr"]?.reasons.map(
          (reason) => reason.code
        )
      ).not.toContain("MARKET_PRICE_REACH");
  });

  it("excludes a player confirmed out for the season", () => {
      const board = buildDraftValueBoard({
        players: [
          {
            player_id: "unavailable-rb",
            name: "Unavailable RB",
            position: "RB",
            tier_rank: 1,
            tier_level: 1,
            fp_rank_ave: 1,
            fp_rank_pos: 1,
            sleeper_adp: 1,
            sleeper_injury_status: "IR",
            sleeper_injury_notes: "Out for the season",
          },
          {
            player_id: "healthy-rb",
            name: "Healthy RB",
            position: "RB",
            tier_rank: 40,
            tier_level: 5,
            fp_rank_ave: 40,
            fp_rank_pos: 18,
            sleeper_adp: 40,
          },
        ],
        teams: 12,
        rounds: 14,
        draftType: "snake",
        currentPick: 1,
        userSlot: 1,
        rosterRequirements: { ...rosterRequirements, FLEX: 2, K: 0, BN: 5 },
        userPositionCounts: { RB: 0, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
        userPositionNeeds: { RB: 2, WR: 2, FLEX: 2, QB: 1, TE: 1, K: 0, DEF: 1, BN: 5 },
        staticValuesByPlayerId: { "unavailable-rb": 100, "healthy-rb": 20 },
      });

      expect(board.metricsByPlayerId["unavailable-rb"]?.availability)
        .toMatchObject({ classification: "unavailable", eligible: false });
      expect(board.recommendations[0]?.player_id).toBe("healthy-rb");
  });

  it("keeps an ordinary questionable player available when value is clear", () => {
      const board = buildDraftValueBoard({
        players: [
          {
            player_id: "questionable-wr",
            name: "Questionable WR",
            position: "WR",
            tier_rank: 10,
            tier_level: 2,
            fp_rank_ave: 10,
            fp_rank_pos: 5,
            sleeper_adp: 10,
            sleeper_injury_status: "Questionable",
          },
          {
            player_id: "healthy-wr",
            name: "Healthy WR",
            position: "WR",
            tier_rank: 18,
            tier_level: 3,
            fp_rank_ave: 18,
            fp_rank_pos: 9,
            sleeper_adp: 18,
          },
        ],
        teams: 12,
        rounds: 14,
        draftType: "snake",
        currentPick: 10,
        userSlot: 4,
        rosterRequirements: { ...rosterRequirements, FLEX: 2, K: 0, BN: 5 },
        userPositionCounts: { RB: 1, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
        userPositionNeeds: { RB: 1, WR: 2, FLEX: 2, QB: 1, TE: 1, K: 0, DEF: 1, BN: 5 },
        staticValuesByPlayerId: { "questionable-wr": 100, "healthy-wr": 92 },
      });

      expect(board.metricsByPlayerId["questionable-wr"]?.availability)
        .toMatchObject({ classification: "short-term-concern", eligible: true });
      expect(board.recommendations[0]?.player_id).toBe("questionable-wr");
  });

  it("flags concern news that is newer than the rankings without changing Val", () => {
    const board = buildDraftValueBoard({
      players: [
        {
          player_id: "fresh-news-wr",
          name: "Fresh News WR",
          position: "WR",
          tier_rank: 10,
          tier_level: 2,
          fp_rank_ave: 10,
          fp_rank_pos: 5,
          sleeper_adp: 10,
          sleeper_injury_status: "Questionable",
          sleeper_projection: {
            newsUpdated: Date.parse("2026-09-04T01:00:00Z"),
          },
          fp_rank_updated_at: Date.parse("2026-09-03T21:00:00Z"),
        },
      ],
      teams: 12,
      rounds: 14,
      draftType: "snake",
      currentPick: 10,
      userSlot: 4,
      rosterRequirements: { ...rosterRequirements, FLEX: 2, K: 0, BN: 5 },
      userPositionCounts: { RB: 1, WR: 0, QB: 0, TE: 0, K: 0, DEF: 0 },
      userPositionNeeds: { RB: 1, WR: 2, FLEX: 2, QB: 1, TE: 1, K: 0, DEF: 1, BN: 5 },
      staticValuesByPlayerId: { "fresh-news-wr": 100 },
    });
    const metric = board.metricsByPlayerId["fresh-news-wr"];

    expect(metric?.staticValue).toBe(100);
    expect(metric?.availability.rankingsMayBeStale).toBe(true);
    expect(metric?.reasons.map((reason) => reason.code))
      .toContain("RANKINGS_MAY_BE_STALE");
    expect(metric?.recommendationConfidence).toBe("low");
  });
});
