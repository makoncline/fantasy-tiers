import { describe, it, expect } from "vitest";
import {
  buildDraftState,
  buildDraftViewModel,
  computeRoundPick,
} from "../../src/lib/draftState";

describe("computeRoundPick", () => {
  it("computes round and pick within round", () => {
    expect(computeRoundPick(1, 10)).toEqual({ round: 1, pick_in_round: 1 });
    expect(computeRoundPick(10, 10)).toEqual({ round: 1, pick_in_round: 10 });
    expect(computeRoundPick(11, 10)).toEqual({ round: 2, pick_in_round: 1 });
  });
});

describe("buildDraftState", () => {
  const playersMap = {
    p1: { player_id: "p1", name: "A One", position: "RB", team: "SF", bye_week: null, rank: 1, tier: 1 },
    p2: { player_id: "p2", name: "B Two", position: "WR", team: "KC", bye_week: null, rank: 2, tier: 1 },
    p3: { player_id: "p3", name: "C Three", position: "QB", team: "BUF", bye_week: null, rank: 3, tier: 2 },
  } as const;

  const draft: any = {
    settings: { teams: 10 },
    draft_order: {},
    metadata: {},
  };

  it("marks drafted players and adds pick/round data; filters available", () => {
    const picks = [
      { draft_slot: 1, round: 1, pick_no: 1, player_id: "p2" },
    ];
    const state = buildDraftState({ playersMap: playersMap as any, draft, picks });
    expect(state.players["p2"].drafted).toBe(true);
    expect(state.players["p2"].pick_no).toBe(1);
    expect(state.players["p2"].picked).toEqual({ overall: 1 });
    expect(state.players["p2"].round).toBe(1);
    expect(state.players["p2"].pick_in_round).toBe(1);
    // Available excludes drafted
    const ids = state.available.map((p) => p.player_id);
    expect(ids).toEqual(["p1", "p3"]);
  });
});

describe("buildDraftViewModel", () => {
  it("preserves recent pick metadata for position-run scoring", () => {
    const player = (id: string, rank: number) => ({
      player_id: id,
      name: id,
      position: "RB" as const,
      team: "SF",
      bye_week: null,
      rank,
      tier: 1,
      tier_rank: rank,
      tier_level: 1,
      position_tier_level: 1,
      sleeper_tier_level: 1,
      fp_rank_ave: rank,
      fp_rank_pos: rank,
      sleeper_adp: rank,
      sleeper_injury_status: null,
      sleeper_injury_notes: null,
    });
    const playersMap = {
      rb1: player("rb1", 1),
      rb2: player("rb2", 2),
      rb3: player("rb3", 3),
      rb4: player("rb4", 4),
    };
    const draft: any = {
      type: "snake",
      settings: { teams: 4, rounds: 4, slots_rb: 1 },
      draft_order: { u1: 4 },
      metadata: {},
    };

    const vm = buildDraftViewModel({
      playersMap,
      draft,
      picks: [
        { draft_slot: 1, round: 1, pick_no: 1, player_id: "rb1" },
        { draft_slot: 2, round: 1, pick_no: 2, player_id: "rb2" },
        { draft_slot: 3, round: 1, pick_no: 3, player_id: "rb3" },
      ],
      userId: "u1",
    });

    expect(vm.recommendationBoard?.metricsByPlayerId.rb4?.positionRunCount)
      .toBe(3);
  });

  it("exposes bench requirements derived from draft rounds", () => {
    const playersMap = {
      p1: {
        player_id: "p1",
        name: "A One",
        position: "RB",
        team: "SF",
        bye_week: null,
        rank: 1,
        tier: 1,
      },
      p2: {
        player_id: "p2",
        name: "B Two",
        position: "WR",
        team: "KC",
        bye_week: null,
        rank: 2,
        tier: 1,
      },
    } as const;
    const draft: any = {
      type: "snake",
      settings: {
        teams: 2,
        rounds: 6,
        slots_qb: 1,
        slots_rb: 1,
        slots_wr: 1,
        slots_te: 0,
        slots_k: 0,
        slots_def: 0,
        slots_flex: 1,
      },
      draft_order: { u1: 1 },
      metadata: {},
    };

    const vm = buildDraftViewModel({
      playersMap: playersMap as any,
      draft,
      picks: [],
      userId: "u1",
    });

    expect(vm.rosterRequirements.BN).toBe(2);
    expect(vm.userRoster?.remainingPositionRequirements.BN).toBe(2);
  });

  it("exposes high-level draft context for agent reasoning", () => {
    const playersMap = {
      rb1: {
        player_id: "rb1",
        name: "Runner One",
        position: "RB",
        team: "SF",
        bye_week: "9",
        rank: 1,
        tier: 1,
      },
      wr1: {
        player_id: "wr1",
        name: "Wide One",
        position: "WR",
        team: "KC",
        bye_week: "10",
        rank: 2,
        tier: 1,
      },
      qb1: {
        player_id: "qb1",
        name: "Passer One",
        position: "QB",
        team: "BUF",
        bye_week: "12",
        rank: 3,
        tier: 1,
      },
      rb2: {
        player_id: "rb2",
        name: "Runner Two",
        position: "RB",
        team: "BAL",
        bye_week: "9",
        rank: 4,
        tier: 2,
      },
      wr2: {
        player_id: "wr2",
        name: "Wide Two",
        position: "WR",
        team: "DAL",
        bye_week: "7",
        rank: 5,
        tier: 2,
      },
    } as const;
    const draft: any = {
      type: "snake",
      settings: {
        teams: 2,
        rounds: 6,
        slots_qb: 1,
        slots_rb: 1,
        slots_wr: 1,
        slots_te: 0,
        slots_k: 0,
        slots_def: 0,
        slots_flex: 1,
      },
      draft_order: { u1: 1 },
      metadata: {},
    };

    const vm = buildDraftViewModel({
      playersMap: playersMap as any,
      draft,
      picks: [
        { draft_slot: 1, round: 1, pick_no: 1, player_id: "rb1" },
        { draft_slot: 2, round: 1, pick_no: 2, player_id: "wr1" },
        { draft_slot: 2, round: 2, pick_no: 3, player_id: "qb1" },
      ],
      userId: "u1",
    });

    expect(vm.draftContext.room.totalPicks).toBe(12);
    expect(vm.draftContext.room.totalPicksRemaining).toBe(9);
    expect(vm.draftContext.room.totalRosterSlotsRemaining).toBe(9);
    expect(vm.draftContext.room.leagueStarterSlotsInitial).toMatchObject({
      QB: 2,
      RB: 2,
      WR: 2,
      TE: 0,
      K: 0,
      DEF: 0,
      FLEX: 2,
    });
    expect(vm.draftContext.room.leagueStarterSlotsRemaining).toMatchObject({
      QB: 1,
      RB: 1,
      WR: 1,
      FLEX: 2,
    });
    expect(vm.draftContext.room.leagueBenchSlotsRemaining).toBe(4);
    expect(
      vm.draftContext.room.leagueBenchDemandInitialByPosition.RB
    ).toBeGreaterThan(0);
    expect(
      vm.draftContext.room.leagueBenchDemandInitialByPosition.DEF
    ).toBe(0);
    expect(vm.draftContext.room.recentRun.counts).toMatchObject({
      QB: 1,
      RB: 1,
      WR: 1,
    });
    expect(vm.draftContext.user.starterSlotsRemaining).toMatchObject({
      QB: 1,
      RB: 0,
      WR: 1,
      FLEX: 1,
    });
    expect(vm.draftContext.user.benchSlotsRemaining).toBe(2);
    expect(vm.draftContext.user.byeWeeksByPosition).toEqual({ RB: ["9"] });

    const rbOutlook = vm.draftContext.positionOutlook.find(
      (row) => row.position === "RB"
    );
    expect(rbOutlook).toMatchObject({
      label: "flex target",
      leagueStarterSlotsRemaining: 3,
      userStarterSlotsRemaining: 1,
    });
    expect(rbOutlook?.topPlayers[0]?.name).toBe("Runner Two");
    expect(vm.draftContext.draftQuestions.length).toBeGreaterThan(3);
  });
});
