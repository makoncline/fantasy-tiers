import { describe, expect, it } from "vitest";
import { DraftDetailsSchema } from "../../src/lib/draftDetails";
import type { SimDraftPlayer } from "../../src/lib/simDraft";
import { predictAvailability } from "./availability-model";

const draft = DraftDetailsSchema.parse({ draft_id: "test", type: "snake", settings: {
  teams: 2, rounds: 6, slots_qb: 1, slots_rb: 1, slots_wr: 1, slots_te: 1, slots_bn: 2,
} });
const players: SimDraftPlayer[] = Array.from({ length: 20 }, (_, index) => ({
  player_id: String(index), name: `Player ${index}`, position: index % 2 ? "WR" : "RB",
  team: null, bye_week: null, rank: index + 1, tier: 1, sleeperAdp: index + 1,
}));

describe("prospective availability experiment", () => {
  it("conditions on the selected player and exact snake distance without future outcomes", () => {
    const input = { draft, picks: [{ player_id: "0", pick_no: 1, round: 1, draft_slot: 1 }],
      selectedId: "1", nextPick: 3, players, candidateIds: ["2", "3"], samples: 32, seed: "frozen" };
    expect(predictAvailability(input)).toEqual({ "2": { platform: 1, roster: 1 }, "3": { platform: 1, roster: 1 } });
    const longWait = { ...input, picks: [], selectedId: "0", nextPick: 4 };
    const result = predictAvailability(longWait);
    expect(result).toEqual(predictAvailability(longWait));
    expect(result["2"]!.roster).toBeLessThan(1);
    expect(() => predictAvailability({ ...input, selectedId: "0" })).toThrow("unavailable");
    expect(() => predictAvailability({ ...input, picks: [{ player_id: "0", pick_no: 4, round: 2, draft_slot: 1 }] })).toThrow("prior pick prefix");
    expect(() => predictAvailability({ ...input, players: players.slice(1) })).toThrow("missing 0");
    expect(() => predictAvailability({ ...input, candidateIds: ["1"] })).toThrow("exclude selected");
    expect(() => predictAvailability({ ...input, nextPick: 4 })).toThrow("future own pick");
  });
});
