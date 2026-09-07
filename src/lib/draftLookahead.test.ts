import { describe, expect, it } from "vitest";
import { DraftCandidateSchema } from "./draftCandidate";
import { buildDraftValueBoard } from "./draftValue";
import { buildStarterAwareValues } from "./beerPlusStrategy";
import { buildDraftLookahead, getLookaheadRoomFacts } from "./draftLookahead";
import type { DraftChoiceSnapshot } from "./draftChoices";
import { DEFAULT_DRAFT_ROSTER_SLOTS, DEFAULT_DRAFT_SCORING_RULES } from "./draftLeagueConfig";

/** Synthetic players: checks state handling, not fantasy quality or outcomes. */
function fixture(): DraftChoiceSnapshot {
  const positions = ["RB", "WR", "QB", "TE"] as const;
  const players = Array.from({ length: 96 }, (_, index) => DraftCandidateSchema.parse({
    player_id: `test-${index}`, name: `Test player ${index}`,
    position: positions[index % positions.length], team: null, bye_week: null,
    rank: index + 1, tier: Math.floor(index / 12) + 1, tier_rank: index + 1,
    tier_level: Math.floor(index / 12) + 1, position_tier_level: Math.floor(index / 16) + 1,
    sleeper_tier_level: null, fp_rank_ave: index + 1, fp_rank_pos: Math.floor(index / 4) + 1,
    sleeper_adp: index + 1, sleeper_board_rank: index + 1, sleeper_board_value: null,
    sleeper_injury_status: null, sleeper_injury_notes: null, sleeper_depth_chart_position: null,
    sleeper_depth_chart_order: null, fp_rank_updated_at: null, sleeper_projection: null,
  }));
  const values = buildStarterAwareValues({ teams: 12, rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
    players: players.map((p, index) => ({ playerId: p.player_id, position: p.position, projectedPoints: 300 - index })) });
  const requirements = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 0, DEF: 1, BN: 5 };
  return { draftId: "synthetic-ui-test", scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    projectionUpdatedAt: null, rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS, values,
    boardInput: { players, teams: 12, rounds: 14, draftType: "snake", currentPick: 4, userSlot: 4,
      rosterRequirements: requirements, userPositionCounts: {}, userPositionNeeds: requirements,
      userRosterPlayers: [],
      teamRosterStates: Array.from({ length: 12 }, (_, index) => ({ draftSlot: index + 1,
        positionCounts: {}, starterNeeds: { ...requirements }, benchSlotsRemaining: 5 })),
      staticValuesByPlayerId: Object.fromEntries(Object.entries(values.valuesByPlayerId).map(([id, value]) => [id, value.value])),
    } };
}

describe("canonical board adapter for an advisory next-pick scenario", () => {
  it("conditions on the first choice, uses the next overall pick, and leaves the active input and board unchanged", () => {
    const snapshot = fixture();
    const current = buildDraftValueBoard(snapshot.boardInput);
    const chosen = current.topRecommendation!.player;
    const before = JSON.stringify({ snapshot, current });
    const result = buildDraftLookahead(snapshot, chosen.player_id, current);
    expect(result.scenario.status).toBe("ready");
    expect(result.snapshot?.boardInput.currentPick).toBe(21);
    expect(result.snapshot?.boardInput.userPositionCounts[chosen.position]).toBe(1);
    expect(result.scenario.selections.filter((p) => p.kind === "opponent")).toHaveLength(16);
    const removed = new Set(result.scenario.selections.map((p) => p.playerId));
    expect(result.choices.every((choice) => !removed.has(choice.player.player_id))).toBe(true);
    expect(JSON.stringify({ snapshot, current })).toBe(before);
    expect(buildDraftValueBoard(snapshot.boardInput)).toEqual(current);
  });
  it("respects the owner one-QB policy AFTER choosing a QB without applying it to opponents", () => {
    const snapshot = fixture();
    const current = buildDraftValueBoard(snapshot.boardInput);
    const qb = current.recommendations.find((p) => p.position === "QB")!;
    expect(qb).toBeDefined();
    const result = buildDraftLookahead(snapshot, qb.player_id, current);
    expect(result.scenario.status).toBe("ready");
    expect(result.board?.recommendations.some((p) => p.position === "QB")).toBe(false);
    expect(result.scenario.selections.some((p) => p.kind === "opponent" && p.position === "QB")).toBe(true);
  });
  it("preserves both FLEX slots and recomputes actual roster counts", () => {
    const snapshot = fixture();
    snapshot.boardInput.userPositionCounts = { RB: 2, WR: 2, QB: 1, TE: 1 };
    snapshot.boardInput.userPositionNeeds = { RB: 0, WR: 0, QB: 0, TE: 0, FLEX: 2, DEF: 1, BN: 5 };
    const current = buildDraftValueBoard(snapshot.boardInput);
    const rb = current.recommendations.find((p) => p.position === "RB")!;
    const result = buildDraftLookahead(snapshot, rb.player_id, current);
    expect(result.snapshot?.boardInput.userPositionNeeds.FLEX).toBe(1);
    expect(result.snapshot?.boardInput.userPositionCounts.RB).toBe(3);
    expect(result.snapshot?.boardInput.userPositionCounts.FLEX).toBe(1);
    const room = result.snapshot?.boardInput.teamRosterStates;
    expect(room).toHaveLength(12);
    const expectedFlex = room!.reduce((sum, team) => sum + (team.starterNeeds.FLEX ?? 0), 0);
    expect(expectedFlex).toBeGreaterThan(0);
    expect(result.snapshot?.boardInput.draftWideNeeds?.FLEX).toBe(expectedFlex);
  });
  it("allows unranked-by-ECR opponents in the market removal order", () => {
    const snapshot = fixture();
    const first = snapshot.boardInput.players[0]!;
    snapshot.boardInput.players = snapshot.boardInput.players.map((p) => p.player_id === first.player_id ? { ...p, fp_rank_ave: null } : p);
    const current = buildDraftValueBoard(snapshot.boardInput);
    expect(current.recommendations.some((p) => p.player_id === first.player_id)).toBe(false);
    const result = buildDraftLookahead(snapshot, current.topRecommendation!.player.player_id, current);
    expect(result.scenario.selections.some((p) => p.kind === "opponent" && p.playerId === first.player_id)).toBe(true);
  });
  it("rejects an owner-ineligible first choice instead of building an illegal path", () => {
    const snapshot = fixture();
    const qb = snapshot.boardInput.players.find((p) => p.position === "QB")!;
    snapshot.boardInput.userPositionCounts = { QB: 1 };
    snapshot.boardInput.userPositionNeeds = { ...snapshot.boardInput.userPositionNeeds, QB: 0 };
    const current = buildDraftValueBoard(snapshot.boardInput);
    const result = buildDraftLookahead(snapshot, qb.player_id, current);
    expect(result.scenario.status).toBe("blocked");
    expect(result.board).toBeNull();
  });
  it("fails the optional scenario without throwing through the recommendation UI", () => {
    const snapshot = fixture();
    const current = buildDraftValueBoard(snapshot.boardInput);
    const id = current.topRecommendation!.player.player_id;
    Object.defineProperty(current, "recommendations", { get() { throw new Error("Injected preview fault"); } });
    const result = buildDraftLookahead(snapshot, id, current);
    expect(result.scenario.status).toBe("blocked");
    expect(result.scenario.message).toContain("unchanged current recommendation");
  });
  it("reports eight teams making sixteen picks for slot four's long wait", () => {
    const facts = getLookaheadRoomFacts(fixture());
    expect(facts).toHaveLength(8);
    expect(facts.map((team) => team.picks)).toEqual(Array(8).fill(2));
  });
  it("does not confuse duplicate roster entries with complete room coverage", () => {
    const snapshot = fixture();
    snapshot.boardInput.teamRosterStates = Array.from({ length: 12 }, () => ({ draftSlot: 1, positionCounts: {}, starterNeeds: {} }));
    const current = buildDraftValueBoard(snapshot.boardInput);
    expect(buildDraftLookahead(snapshot, current.topRecommendation!.player.player_id, current).scenario.status).toBe("blocked");
  });
  it("rebuilds against changed source values, without changing the saved first board", () => {
    const snapshot = fixture(); const current = buildDraftValueBoard(snapshot.boardInput);
    const before = JSON.stringify(current); const changed = structuredClone(snapshot);
    changed.boardInput.staticValuesByPlayerId = Object.fromEntries(Object.entries(changed.boardInput.staticValuesByPlayerId).map(([id, value]) => [id, value + 20]));
    const board = buildDraftValueBoard(changed.boardInput);
    const next = buildDraftLookahead(changed, board.topRecommendation!.player.player_id, board);
    expect(next.snapshot?.boardInput.staticValuesByPlayerId).toEqual(changed.boardInput.staticValuesByPlayerId);
    expect(JSON.stringify(current)).toBe(before);
  });

});
