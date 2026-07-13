import { describe, expect, it } from "vitest";

import { DraftDetailsSchema } from "@/lib/draftDetails";
import { buildDraftViewModel } from "@/lib/draftState";
import { DraftPicksSchema } from "@/lib/schemas";
import {
  advanceUntilUserTurn,
  advanceToEnd,
  bundlePlayerToSimPlayer,
  createDefaultSimDraftConfig,
  createSimDraft,
  getDraftSlotForPick,
  getSimDraftSnapshot,
  makeUserPick,
  playersMapFromSimPlayers,
  toSleeperDraftDetails,
  toSleeperDraftPicks,
  undoLastPick,
  type SimDraftPlayer,
} from "@/lib/simDraft";

const players = [
  p("rb1", "Runner One", "RB", 1, 1, 1),
  p("wr1", "Wide One", "WR", 2, 1, 2),
  p("rb2", "Runner Two", "RB", 3, 1, 3),
  p("wr2", "Wide Two", "WR", 4, 1, 4),
  p("qb1", "Passer One", "QB", 5, 2, 5),
  p("te1", "Tight One", "TE", 6, 2, 6),
  p("rb3", "Runner Three", "RB", 7, 2, 7),
  p("wr3", "Wide Three", "WR", 8, 2, 8),
  p("rb4", "Runner Four", "RB", 9, 3, 9),
  p("wr4", "Wide Four", "WR", 10, 3, 10),
  p("rb5", "Runner Five", "RB", 11, 3, 11),
  p("wr5", "Wide Five", "WR", 12, 3, 12),
  p("def1", "Defense One", "DEF", 40, 6, 40),
  p("k1", "Kicker One", "K", 45, 7, 45),
] satisfies SimDraftPlayer[];

describe("simDraft", () => {
  it("computes snake draft slots", () => {
    expect(getDraftSlotForPick(1, 4, "snake")).toBe(1);
    expect(getDraftSlotForPick(4, 4, "snake")).toBe(4);
    expect(getDraftSlotForPick(5, 4, "snake")).toBe(4);
    expect(getDraftSlotForPick(8, 4, "snake")).toBe(1);
    expect(getDraftSlotForPick(5, 4, "linear")).toBe(1);
  });

  it("advances bot picks and pauses on the user's turn", () => {
    const config = createDefaultSimDraftConfig({
      teams: 4,
      rounds: 3,
      userSlot: 3,
      seed: "pause-test",
      rosterSlots: {
        QB: 1,
        RB: 1,
        WR: 1,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
      },
    });

    const state = advanceUntilUserTurn(createSimDraft(config), players);
    const snapshot = getSimDraftSnapshot(state, players);

    expect(snapshot.picks).toHaveLength(2);
    expect(snapshot.currentPickNo).toBe(3);
    expect(snapshot.onClockSlot).toBe(3);
    expect(snapshot.isUserTurn).toBe(true);
    expect(snapshot.availablePlayerIds).not.toContain(
      snapshot.picks[0]?.player_id
    );
  });

  it("makes a user pick, advances back around, and undoes the latest pick", () => {
    const config = createDefaultSimDraftConfig({
      teams: 4,
      rounds: 3,
      userSlot: 3,
      seed: "undo-test",
      rosterSlots: {
        QB: 1,
        RB: 1,
        WR: 1,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
      },
    });

    const waiting = advanceUntilUserTurn(createSimDraft(config), players);
    const userChoice = getSimDraftSnapshot(waiting, players).availablePlayerIds[0];
    if (!userChoice) throw new Error("expected an available user pick");
    const picked = makeUserPick(waiting, userChoice, players);
    const nextTurn = advanceUntilUserTurn(picked, players);
    const undone = undoLastPick(nextTurn);

    expect(picked.picks[picked.picks.length - 1]).toMatchObject({
      draft_slot: 3,
      pick_no: 3,
      player_id: userChoice,
    });
    expect(nextTurn.picks.length).toBeGreaterThan(picked.picks.length);
    expect(undone.picks).toHaveLength(nextTurn.picks.length - 1);

    const afterUndo = getSimDraftSnapshot(undone, players);
    const removedPick = nextTurn.picks[nextTurn.picks.length - 1];
    expect(afterUndo.availablePlayerIds).toContain(removedPick?.player_id);
  });

  it("keeps bot picks deterministic for the same seed", () => {
    const config = createDefaultSimDraftConfig({
      teams: 4,
      rounds: 3,
      userSlot: 3,
      seed: "stable-seed",
    });

    const first = advanceUntilUserTurn(createSimDraft(config), players);
    const second = advanceUntilUserTurn(createSimDraft(config), players);

    expect(toSleeperDraftPicks(first)).toEqual(toSleeperDraftPicks(second));
  });

  it("supports both Sleeper market and ADP-needs strategies", () => {
    const marketConfig = createDefaultSimDraftConfig({
      teams: 4,
      rounds: 3,
      userSlot: 3,
      seed: "market-strategy",
      botStrategy: "sleeper-market-v1",
    });
    const adpNeedsConfig = {
      ...marketConfig,
      botStrategy: "sleeper-adp-needs" as const,
    };

    const market = advanceToEnd(createSimDraft(marketConfig), players);
    const adpNeeds = advanceToEnd(createSimDraft(adpNeedsConfig), players);

    expect(market.picks).toHaveLength(12);
    expect(adpNeeds.picks).toHaveLength(12);
    expect(market.config.botStrategy).toBe("sleeper-market-v1");
    expect(adpNeeds.config.botStrategy).toBe("sleeper-adp-needs");
  });

  it("allows different bot strategies in the same simulated room", () => {
    const config = createDefaultSimDraftConfig({
      teams: 4,
      rounds: 3,
      userSlot: 3,
      seed: "mixed-strategies",
      botStrategy: "sleeper-adp-needs",
      botStrategiesBySlot: {
        "1": "sleeper-market-v1",
        "4": "sleeper-market-v1",
      },
    });

    const completed = advanceToEnd(createSimDraft(config), players);

    expect(completed.picks).toHaveLength(12);
    expect(completed.config.botStrategiesBySlot).toEqual({
      "1": "sleeper-market-v1",
      "4": "sleeper-market-v1",
    });
  });

  it("rejects an unsupported mock size before making any picks", () => {
    const config = createDefaultSimDraftConfig({
      teams: 10,
      rounds: 15,
      userSlot: 5,
    });

    expect(() => advanceUntilUserTurn(createSimDraft(config), players)).toThrow(
      "requires 150 ranked players"
    );
  });

  it("feeds Sleeper-shaped state into the draft view model", () => {
    const config = createDefaultSimDraftConfig({
      teams: 4,
      rounds: 3,
      userSlot: 3,
      userId: "agent-user",
      seed: "view-model",
      rosterSlots: {
        QB: 1,
        RB: 1,
        WR: 1,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
      },
    });
    const state = advanceUntilUserTurn(createSimDraft(config), players);
    const vm = buildDraftViewModel({
      playersMap: playersMapFromSimPlayers(players),
      draft: toSleeperDraftDetails(state),
      picks: toSleeperDraftPicks(state),
      userId: "agent-user",
    });

    expect(vm.draftContext.room.currentPick).toBe(3);
    expect(vm.userRoster).toBeDefined();
    expect(vm.available.map((player) => player.player_id)).not.toContain(
      state.picks[0]?.player_id
    );
    expect(vm.draftContext.user.draftSlot).toBe(3);
  });

  it("validates simulated Sleeper state with the live Zod schemas", () => {
    const config = createDefaultSimDraftConfig({
      teams: 4,
      rounds: 3,
      userSlot: 3,
      userId: "schema-user",
      seed: "schema-compat",
    });
    const waiting = advanceUntilUserTurn(createSimDraft(config), players);
    const userChoice = getSimDraftSnapshot(waiting, players).availablePlayerIds[0];
    if (!userChoice) throw new Error("expected an available user pick");
    const state = makeUserPick(waiting, userChoice, players);

    const draft = toSleeperDraftDetails(state);
    const picks = toSleeperDraftPicks(state);

    expect(DraftDetailsSchema.parse(draft)).toEqual(draft);
    expect(DraftPicksSchema.parse(picks)).toEqual(picks);
    expect(draft.draft_order["schema-user"]).toBe(3);
    expect(picks[picks.length - 1]).toMatchObject({
      draft_slot: 3,
      player_id: userChoice,
    });
  });

  it("does not make rank-only historical players draftable", () => {
    expect(
      bundlePlayerToSimPlayer(
        bundlePlayer({
          player_id: "24",
          name: "matt ryan",
          position: "QB",
          team: null,
          sleeper: { rank: 246, adp: 999, pts: null },
        })
      )
    ).toBeNull();

    expect(
      bundlePlayerToSimPlayer(
        bundlePlayer({
          player_id: "qb-current",
          name: "Current QB",
          position: "QB",
          sleeper: { rank: 20, adp: 118, pts: null },
        })
      )
    ).toMatchObject({
      player_id: "qb-current",
      sleeperAdp: 118,
    });
  });

  it("keeps ranked special teams draftable even when Sleeper ADP is a placeholder", () => {
    expect(
      bundlePlayerToSimPlayer(
        bundlePlayer({
          player_id: "HOU",
          name: "Houston Texans",
          position: "DEF",
          team: "HOU",
          tiers: { rank: 1, tier: 1 },
          sleeper: { rank: 1, adp: 999, pts: null },
        })
      )
    ).toMatchObject({
      player_id: "HOU",
      position: "DEF",
      rank: 1,
      sleeperAdp: null,
      sleeper_adp: null,
    });
  });
});

function p(
  player_id: string,
  name: string,
  position: SimDraftPlayer["position"],
  rank: number,
  tier: number,
  sleeperAdp: number
): SimDraftPlayer {
  return {
    player_id,
    name,
    position,
    team: position === "DEF" ? name : "KC",
    bye_week: "10",
    rank,
    tier,
    sleeperAdp,
    sleeperRank: rank,
  };
}

function bundlePlayer(
  overrides: Partial<{
    player_id: string;
    name: string;
    position: string;
    team: string | null;
    tiers: Partial<{
      rank: number | null;
      tier: number | null;
    }>;
    sleeper: Partial<{
      rank: number | null;
      adp: number | null;
      pts: number | null;
    }>;
  }>
) {
  return {
    player_id: overrides.player_id ?? "player-1",
    name: overrides.name ?? "Player One",
    position: overrides.position ?? "QB",
    team: overrides.team ?? "KC",
    bye_week: 10,
    tiers: {
      rank: overrides.tiers?.rank ?? null,
      tier: overrides.tiers?.tier ?? null,
    },
    sleeper: {
      rank: overrides.sleeper?.rank ?? null,
      adp: overrides.sleeper?.adp ?? null,
      pts: overrides.sleeper?.pts ?? null,
      injuryStatus: null,
      injuryNotes: null,
    },
    fantasypros: {
      rank: null,
      tier: null,
      pos_rank: "QB",
      ecr: null,
      ecr_average: null,
      ecr_std: null,
      ecr_round_pick: null,
      pts: null,
      baseline_pts: null,
      adp: null,
      player_owned_avg: null,
    },
    calc: {
      value: null,
      positional_scarcity: null,
      market_delta: null,
    },
  };
}
