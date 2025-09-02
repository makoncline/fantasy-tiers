import { describe, it, expect } from "vitest";
import { buildDraftViewModel } from "../../src/lib/draftState";

describe("buildDraftViewModel", () => {
  const playersMap = {
    p1: { player_id: "p1", name: "A One", position: "RB", team: "SF", bye_week: null, rank: 1, tier: 1 },
    p2: { player_id: "p2", name: "B Two", position: "WR", team: "KC", bye_week: null, rank: 2, tier: 1 },
    p3: { player_id: "p3", name: "C Three", position: "QB", team: "BUF", bye_week: null, rank: 3, tier: 2 },
    p4: { player_id: "p4", name: "D Four", position: "WR", team: "DAL", bye_week: null, rank: 4, tier: 2 },
  } as const;

  const draft: any = {
    settings: { teams: 10, slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1, slots_k: 1, slots_def: 1, slots_flex: 1, rounds: 16 },
    draft_order: { user123: 3 },
    metadata: {},
  };

  it("groups available by position, computes rosters and recommendations", () => {
    const picks = [
      { draft_slot: 1, round: 1, pick_no: 1, player_id: "p2" },
    ];
    const vm = buildDraftViewModel({ playersMap: playersMap as any, draft, picks, userId: "user123", topLimit: 2 });
    // available excludes drafted p2
    const ids = vm.available.map((p) => p.player_id);
    expect(ids).toEqual(["p1", "p3", "p4"]);
    // grouped
    expect(Object.keys(vm.availableByPosition)).toEqual(expect.arrayContaining(["RB", "WR", "QB"]));
    // topAvailable limited to 2 where possible
    expect(vm.topAvailablePlayersByPosition.WR.length).toBeLessThanOrEqual(2);
    // user roster exists for slot 3 (even if empty)
    expect(vm.userRoster).toBeDefined();
    // recommendations present (may be null if no data)
    expect("nextPickRecommendations" in vm).toBe(true);
  });
});

