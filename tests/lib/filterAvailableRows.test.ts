import { describe, it, expect } from "vitest";
import {
  filterAvailableRows,
  type PositionFilter,
} from "@/app/draft-assistant/_lib/filterAvailableRows";
import type { PlayerRow } from "@/lib/playerRows";

function makeRow(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    player_id: overrides.player_id ?? "p1",
    name: overrides.name ?? "John Doe",
    position: overrides.position ?? "RB",
    team: overrides.team ?? "SF",
    bye_week: overrides.bye_week ?? 9,
    // include rank fields
    rank: overrides.rank ?? null,
    bc_rank: overrides.bc_rank,
    bc_tier: overrides.bc_tier,
    fp_pts: overrides.fp_pts ?? null,
    ecr_round_pick: overrides.ecr_round_pick,
    fp_tier: overrides.fp_tier ?? null,
    fp_value: overrides.fp_value ?? null,
    fp_positional_scarcity_slope:
      overrides.fp_positional_scarcity_slope ?? null,
    sleeper_pts: overrides.sleeper_pts ?? null,
    sleeper_adp: overrides.sleeper_adp ?? null,
    sleeper_rank_overall: overrides.sleeper_rank_overall ?? null,
    fp_adp: overrides.fp_adp ?? null,
    fp_rank_overall: overrides.fp_rank_overall ?? null,
    fp_rank_pos: overrides.fp_rank_pos ?? null,
    fp_baseline_pts: overrides.fp_baseline_pts ?? null,
    fp_player_owned_avg: overrides.fp_player_owned_avg ?? null,
    market_delta: overrides.market_delta ?? null,
    val: overrides.val ?? null,
    ps: overrides.ps ?? null,
  } as PlayerRow;
}

describe("filterAvailableRows", () => {
  const base: PlayerRow[] = [
    makeRow({ player_id: "a", name: "Alpha One", position: "RB", bc_rank: 1 }),
    makeRow({ player_id: "b", name: "Bravo Two", position: "WR", bc_rank: 2 }),
    // Unranked but drafted
    makeRow({
      player_id: "c",
      name: "Charlie Three",
      position: "TE",
      bc_rank: undefined,
    }),
  ];

  it("includes drafted players when showDrafted is true", () => {
    const draftedIds = new Set(["c"]);
    const draftedNames = new Set<string>();
    const out = filterAvailableRows(base, {
      position: "ALL" as PositionFilter,
      showDrafted: true,
      showUnranked: true,
      draftedIds,
      draftedNames,
    });
    expect(out.some((r) => r.player_id === "c")).toBe(true);
  });

  it("excludes drafted players when showDrafted is false (by id and name)", () => {
    const draftedIds = new Set(["a", "c"]);
    const draftedNames = new Set(["bravo two" /* normalized */]);
    const out = filterAvailableRows(base, {
      position: "ALL" as PositionFilter,
      showDrafted: false,
      showUnranked: true,
      draftedIds,
      draftedNames,
    });
    expect(out.find((r) => r.player_id === "a")).toBeUndefined();
    expect(out.find((r) => r.player_id === "b")).toBeUndefined();
    expect(out.find((r) => r.player_id === "c")).toBeUndefined();
  });

  it("when showUnranked is false, still includes drafted unranked players (override)", () => {
    const draftedIds = new Set(["c"]);
    const draftedNames = new Set<string>();
    const out = filterAvailableRows(base, {
      position: "ALL" as PositionFilter,
      showDrafted: true,
      showUnranked: false,
      draftedIds,
      draftedNames,
    });
    // unranked drafted 'c' should still be included
    expect(out.some((r) => r.player_id === "c")).toBe(true);
  });
});
