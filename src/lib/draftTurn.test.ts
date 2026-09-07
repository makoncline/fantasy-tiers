import { describe, expect, it } from "vitest";
import { getDraftTurnContext, getNextPickForSlot, type DraftTurnInput } from "./draftTurn";

const base = { teams: 12, rounds: 14, draftType: "snake" } as const;

describe("draft turn context", () => {
  it.each([
    [4, 3, "waiting", 4, 1],
    [4, 4, "waiting", 21, 16],
    [12, 12, "back-to-back", 13, 0],
    [1, 24, "back-to-back", 25, 0],
    [4, 165, "no-future-pick", null, null],
    [4, 169, "no-future-pick", null, null],
  ] as const)("slot %i at room pick %i", (userSlot, currentPick, state, target, count) => {
    expect(getDraftTurnContext({ ...base, userSlot, currentPick })).toMatchObject({
      state, comebackTargetPick: target, opponentPicksBeforeTarget: count,
    });
  });

  it("counts pending opponents across all slots and every draft pick", () => {
    // Independent explicit draft order, not the scheduler under test.
    const order = Array.from({ length: 14 }, (_, round) =>
      Array.from({ length: 12 }, (_, index) => round % 2 === 0 ? index + 1 : 12 - index)
    ).flat();
    for (let userSlot = 1; userSlot <= 12; userSlot++) {
      for (let currentPick = 1; currentPick <= order.length; currentPick++) {
        const state = getDraftTurnContext({ ...base, userSlot, currentPick });
        const futureIndex = order.findIndex((slot, index) => index >= currentPick && slot === userSlot);
        if (futureIndex < 0) {
          expect(state.state).toBe("no-future-pick");
          expect(state.opponentPicksBeforeTarget).toBeNull();
          continue;
        }
        const startIndex = currentPick - 1 + (order[currentPick - 1] === userSlot ? 1 : 0);
        const expectedCount = futureIndex - startIndex;
        expect(state.comebackTargetPick).toBe(futureIndex + 1);
        expect(state.opponentPicksBeforeTarget).toBe(expectedCount);
        expect(state.state).toBe(expectedCount === 0 ? "back-to-back" : "waiting");
      }
    }
  });

  it("supports linear waits without inventing snake-turn boundaries", () => {
    expect(getDraftTurnContext({ ...base, draftType: "linear", userSlot: 12, currentPick: 12 }))
      .toMatchObject({ state: "waiting", comebackTargetPick: 24, opponentPicksBeforeTarget: 11 });
  });

  it.each([
    { userSlot: undefined }, { userSlot: null }, { userSlot: 0 }, { userSlot: 13 },
    { userSlot: 1.5 }, { currentPick: 0 }, { currentPick: Number.NaN },
    { teams: 0 }, { teams: 1.5 }, { rounds: 0 }, { rounds: Number.POSITIVE_INFINITY },
    { rounds: undefined }, { draftType: "auction" },
  ])("does not treat missing or invalid turn data as an exact boundary: %j", (change) => {
    const input: DraftTurnInput = { ...base, currentPick: 12, userSlot: 12, ...change };
    const state = getDraftTurnContext(input);
    expect(state.state).toBe("unknown");
    expect(state.opponentPicksBeforeTarget).toBeNull();
  });

  it("retains legacy estimated targets when rounds are unknown", () => {
    const input = { ...base, rounds: undefined, userSlot: 12, currentPick: 12 };
    const state = getDraftTurnContext(input);
    expect(state.nextPick).toBe(getNextPickForSlot(input));
    expect(state.comebackTargetPick).toBe(getNextPickForSlot({ ...input, currentPick: 13 }));
    expect(state.state).toBe("unknown");
  });
});
