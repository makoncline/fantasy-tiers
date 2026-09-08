import { describe, expect, it } from "vitest";
import { applyEspnMessage, decodeEspnInit } from "./protocol";

// Small synthetic record with the field order observed in the ESPN mock HAR.
// No owner data, authentication values, or private queue data are retained.
function initFrame() {
  const bytes: number[] = [];
  const int = (n: number) => { const a = new Uint8Array(4); new DataView(a.buffer).setInt32(0, n); bytes.push(...a); };
  const ints = (...values: number[]) => values.forEach(int);
  const object = (version: number, write: () => void) => { ints(1, version); write(); };
  object(1, () => {
    ints(99, 2);
    object(1, () => {
      ints(99, 1, 1, 0, 3); // league, snake, universe, absent date, paused
      int(0); // no auction block
      int(0); // rules are not needed for this state fixture
      int(0); // limits
      int(1);
      object(1, () => ints(99, 1, 4, 0));
      int(4);
      [1, 2, 2, 1].forEach((teamId, i) => object(3, () => {
        ints(99, teamId, i + 1, i === 0 ? 101 : -1, i === 0 ? 1 : 0, 0, 0);
        bytes.push(0); ints(0, 0);
      }));
      int(2);
      [1, 2].forEach((id) => object(2, () => ints(99, id, id - 1, 0, 0, 0, 0)));
    });
  });
  return `INIT ${btoa(String.fromCharCode(...bytes))}`;
}

describe("ESPN live draft protocol", () => {
  it("restores a board, applies picks to ESPN's order, and recovers after undo and reconnect", () => {
    const initial = applyEspnMessage(null, initFrame());
    expect(initial?.picks.filter((p) => p.playerId !== -1)).toHaveLength(1);
    let state = applyEspnMessage(initial, "STATE 1\n");
    state = applyEspnMessage(state, "SELECTED 2 102 1 ignored-owner-id\n");
    expect(state?.picks[1]).toMatchObject({ pickNumber: 2, teamId: 2, playerId: 102 });
    expect(applyEspnMessage(state, "SELECTED 2 102 1")).toBe(state);
    state = applyEspnMessage(state, "SELECTED 2 103 2\n");
    expect(state?.picks[2]).toMatchObject({ pickNumber: 3, teamId: 2, playerId: 103 });
    state = applyEspnMessage(state, "UNDONE 3\n");
    expect(state?.picks[2]?.playerId).toBe(-1);
    state = applyEspnMessage(state, "SELECTED 2 104 2\n");
    expect(state?.picks[2]?.playerId).toBe(104);
    state = applyEspnMessage(state, "UNDONE 2\n");
    expect(state?.picks.map((pick) => pick.playerId)).toEqual([101, -1, -1, -1]);
    state = applyEspnMessage(state, "SELECTED 2 105 1\n");
    expect(state?.picks[1]?.playerId).toBe(105);
    expect(applyEspnMessage(state, initFrame())).toEqual(initial);
    expect(applyEspnMessage(state, "RESET")).toBeNull();
  });

  it("fails closed on unknown versions, truncated state, and an unexpected team", () => {
    expect(() => decodeEspnInit(btoa(String.fromCharCode(0, 0, 0, 1, 0, 0, 0, 2)))).toThrow("version");
    expect(() => decodeEspnInit("AAAAAQ==")).toThrow();
    const initial = applyEspnMessage(null, initFrame());
    expect(() => applyEspnMessage(initial, "SELECTED 1 105 1")).toThrow("pick order");
    expect(() => applyEspnMessage(initial, "STATE nope")).toThrow("Invalid");
  });
});
