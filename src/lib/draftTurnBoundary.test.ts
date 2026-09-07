import { describe, expect, it } from "vitest";
import {
  buildDraftValueBoard,
  type DraftTeamRosterState,
  type DraftValueBoardInput,
  type DraftValuePlayerInput,
} from "./draftValue";

function fixture(adp: number | null): DraftValueBoardInput<DraftValuePlayerInput> {
  return {
    teams: 12, rounds: 14, draftType: "snake", userSlot: 12, currentPick: 12,
    rosterRequirements: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, DEF: 1, K: 0, BN: 5 },
    userPositionCounts: {},
    userPositionNeeds: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, DEF: 1, BN: 5 },
    players: [
      { player_id: "candidate", name: "Candidate", position: "RB", fp_rank_ave: 12,
        fp_rank_pos: 6, tier_level: 2, position_tier_level: 2,
        sleeper_adp: adp, sleeper_board_rank: adp },
      { player_id: "receiver", name: "Receiver", position: "WR", fp_rank_ave: 14,
        fp_rank_pos: 6, tier_level: 2, position_tier_level: 2, sleeper_adp: 14 },
    ],
    staticValuesByPlayerId: { candidate: 80, receiver: 78 },
  };
}

const room: DraftTeamRosterState[] = Array.from({ length: 12 }, (_, index) => ({
  draftSlot: index + 1, positionCounts: {}, starterNeeds: { RB: 2, WR: 2, FLEX: 2 },
  benchSlotsRemaining: 5,
}));

describe("canonical zero-opponent boundary", () => {
  it.each([2, 12, 180, null])("returns survival 1 independently of market rank %s or room data", (adp) => {
    for (const [currentPick, userSlot] of [[12, 12], [24, 1]] as const) {
      for (const teamRosterStates of [undefined, [], room]) {
        const input = {
          ...fixture(adp), currentPick, userSlot, teamRosterStates,
          draftWideNeeds: { RB: 24, WR: 24 },
          players: [
            ...fixture(adp).players,
            ...Array.from({ length: 3 }, (_, index): DraftValuePlayerInput => ({
              player_id: `previous-${index}`, position: "RB", fp_rank_ave: index + 1,
              fp_rank_pos: index + 1, picked: { overall: currentPick - index - 1 },
            })),
          ],
        };
        const board = buildDraftValueBoard(input);
        const metrics = board.metricsByPlayerId.candidate!;
        expect(metrics.comebackProbability).toBe(1);
        expect(metrics.comebackLabel).toBe("likely");
        expect(metrics.urgencyScore).toBe(0);
        expect(metrics.roomDemandScore).toBe(0);
        expect(metrics.components.demand).toBe(0);
        expect(metrics.actionLabel).toBe("can wait");
        expect(metrics.reasons.some((r) => ["LIKELY_GONE", "ROOM_DEMAND", "TIER_CLIFF"].includes(r.code))).toBe(false);
        expect([...metrics.recommendationExplanation.pros, ...metrics.recommendationExplanation.cons].join(" "))
          .not.toMatch(/Likely last pick|Likely gone before|Can probably wait based on ADP/);
      }
    }
  });

  it("does not claim certainty while an opponent is still on the clock", () => {
    const board = buildDraftValueBoard({ ...fixture(12), currentPick: 3, userSlot: 4 });
    const probability = board.metricsByPlayerId.candidate!.comebackProbability;
    expect(probability).not.toBeNull();
    expect(probability).toBeLessThan(1);
  });

  it("preserves the legacy positive-wait forecast with no room adjustment", () => {
    const board = buildDraftValueBoard({ ...fixture(12), currentPick: 4, userSlot: 4 });
    const expected = 1 / (1 + Math.exp(1.35 * ((21 - 12) / 7.2)));
    expect(board.metricsByPlayerId.candidate!.comebackProbability).toBeCloseTo(expected, 2);
    expect(board.metricsByPlayerId.candidate!.urgencyScore).toBeGreaterThan(0);
  });

  it("keeps market-price and roster contributions separate from opponent urgency", () => {
    const near = buildDraftValueBoard(fixture(12)).metricsByPlayerId.candidate!;
    const early = buildDraftValueBoard(fixture(180)).metricsByPlayerId.candidate!;
    expect(near.comebackProbability).toBe(1);
    expect(early.comebackProbability).toBe(1);
    expect(near.components.starterNeed).toBeGreaterThan(0);
    expect(early.components.timing).not.toBe(near.components.timing);
  });

  it("does not convert missing turn data into a final-pick scoring exemption", () => {
    const input = fixture(180);
    const missingSlot = buildDraftValueBoard({ ...input, userSlot: undefined });
    expect(missingSlot.metricsByPlayerId.candidate!.comebackProbability).toBeNull();
    expect(missingSlot.metricsByPlayerId.candidate!.adpDeltaPicks).not.toBeNull();
    const missingRounds = buildDraftValueBoard({ ...fixture(12), rounds: undefined });
    expect(missingRounds.metricsByPlayerId.candidate!.comebackProbability).not.toBe(1);
  });

  it("keeps the required final defense and final-pick timing exemption", () => {
    const board = buildDraftValueBoard({
      ...fixture(null), currentPick: 165, userSlot: 4,
      userPositionCounts: { QB: 1, RB: 5, WR: 6, TE: 1 },
      userPositionNeeds: { DEF: 1, BN: 0 },
      players: [{ player_id: "defense", name: "Defense", position: "DEF", fp_rank_ave: 160,
        fp_rank_pos: 1, tier_level: 9, position_tier_level: 1 }],
      staticValuesByPlayerId: { defense: 5 },
    });
    expect(board.topRecommendation?.player.player_id).toBe("defense");
    expect(board.metricsByPlayerId.defense!.comebackProbability).toBeNull();
    expect(board.metricsByPlayerId.defense!.components).toMatchObject({ timing: 0, demand: 0 });
  });
});
