import { describe, it, expect } from "vitest";
import { buildDraftState, computeRoundPick } from "../../src/lib/draftState";

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
    expect(state.players["p2"].round).toBe(1);
    expect(state.players["p2"].pick_in_round).toBe(1);
    // Available excludes drafted
    const ids = state.available.map((p) => p.player_id);
    expect(ids).toEqual(["p1", "p3"]);
  });
});

