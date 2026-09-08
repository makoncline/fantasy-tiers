import { describe, expect, it } from "vitest";
import { buildDraftValueBoard } from "./index";
import { draftChoiceFixture } from "../draftChoiceFixture";

function input() {
  const fixture = draftChoiceFixture().boardInput;
  return { ...fixture, qualityRanksByPlayerId: Object.fromEntries(fixture.players.map(p => [p.player_id, p.fp_rank_ave!])) };
}

describe("selected source rank order", () => {
  it("keeps same-position order despite value/timing changes and preserves score accounting", () => {
    const before = input();
    const better = before.players[0]!;
    const lower = before.players[4]!;
    const changed = { ...before, staticValuesByPlayerId: { ...before.staticValuesByPlayerId, [lower.player_id]: 1000 } };
    const board = buildDraftValueBoard(changed);
    const bm = board.metricsByPlayerId[better.player_id]!;
    const lm = board.metricsByPlayerId[lower.player_id]!;
    expect(lm.staticValue).toBe(1000);
    expect(lm.components.rankingOrder).toBeLessThan(0);
    expect(board.recommendations.indexOf(better)).toBeLessThan(board.recommendations.indexOf(lower));
    expect(lm.recommendationScore).toBeLessThanOrEqual(bm.recommendationScore);
    for (const p of board.recommendations) {
      const m = board.metricsByPlayerId[p.player_id]!;
      expect(m.recommendationScore).toBeCloseTo(Object.values(m.components).reduce((a,b) => a+b, 0), 1);
    }
    expect(bm.components.rankingOrder).toBe(0);
  });
  it("uses the supplied source order, removes drafted leaders, and fails closed on missing source rank", () => {
    const original = input();
    const a = original.players[0]!; const b = original.players[4]!;
    const swapped = { ...original, qualityRanksByPlayerId: { ...original.qualityRanksByPlayerId, [a.player_id]: 5, [b.player_id]: 1 } };
    const board = buildDraftValueBoard(swapped);
    expect(board.recommendations.indexOf(b)).toBeLessThan(board.recommendations.indexOf(a));
    const after = buildDraftValueBoard({ ...swapped, players: swapped.players.map(p => ({ ...p, drafted: p.player_id === b.player_id })) });
    expect(after.metricsByPlayerId[a.player_id]!.components.rankingOrder).toBe(0);
    const missing = buildDraftValueBoard({ ...original, qualityRanksByPlayerId: {} });
    expect(missing.topRecommendation).toBeNull();
  });
  it("allows an existing material-risk penalty to break the source order", () => {
    const original = input();
    const a = original.players[0]!; const b = original.players[4]!;
    const board = buildDraftValueBoard({ ...original,
      staticValuesByPlayerId: { ...original.staticValuesByPlayerId, [b.player_id]: 1000 },
      players: original.players.map(p => p.player_id === a.player_id ? { ...p, sleeper_injury_status: "Out" } : p) });
    expect(board.metricsByPlayerId[a.player_id]!.components.risk).toBeLessThan(board.metricsByPlayerId[b.player_id]!.components.risk);
    expect(board.recommendations.findIndex(p=>p.player_id===b.player_id)).toBeLessThan(board.recommendations.findIndex(p=>p.player_id===a.player_id));
  });
});
