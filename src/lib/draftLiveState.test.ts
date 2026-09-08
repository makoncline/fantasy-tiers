import { canAcceptEmptyPickResponse } from "./draftLiveState";
import { describe, expect, it } from "vitest";
import { getPickFeedStatus, normalizeLivePicks } from "./draftLiveState";
const pick = (n: number) => ({ pick_no: n, draft_slot: n, round: 1, player_id: `test-${n}` });
describe("live pick response integrity", () => {
  it("accepts and sorts a complete prefix", () => expect(normalizeLivePicks([pick(2), pick(1)])).toEqual([pick(1), pick(2)]));
  it("accepts a valid shorter prefix after an undo, including a reset", () => {
    expect(normalizeLivePicks([pick(1), pick(2)])).toHaveLength(2);
    expect(normalizeLivePicks([pick(1)])).toHaveLength(1);
    expect(normalizeLivePicks([])).toEqual([]);
  });
  it.each([null, {}, [pick(1), {}], [pick(2)], [pick(1), pick(1)],
    [pick(1), { ...pick(2), player_id: "test-1" }], [{ ...pick(1), player_id: " " }], [{ ...pick(1), round: -1 }]])(
    "rejects incomplete data instead of deleting or skipping picks (%j)", (raw) => expect(() => normalizeLivePicks(raw)).toThrow());
  it("accepts all-row numeric-string normalization without losing records", () => {
    expect(normalizeLivePicks([{ pick: "1", slot: "4", r: "1", pid: "QB-ID" }])).toEqual([{ pick_no: 1, draft_slot: 4, round: 1, player_id: "QB-ID" }]);
  });
});
describe("pick-feed freshness is not player-source freshness", () => {
  const input = { checkedAt: 100_000, now: 104_000, hasError: false };
  it("reports response age, not a claim of synchronized server state", () => expect(getPickFeedStatus(input).label).toBe("Pick feed checked 4s ago"));
  it("shows errors even after a recent good response", () => expect(getPickFeedStatus({ ...input, hasError: true }).state).toBe("error"));
  it("keeps completed drafts complete when their final receipt arrives after the clock stops", () => {
    expect(getPickFeedStatus({ ...input, checkedAt: 110_000, complete: true }).state).toBe("complete");
    expect(getPickFeedStatus({ ...input, complete: true, hasError: true }).state).toBe("error");
  });
  it("flags stopped polling, missing timestamps, paused fetches, and future timestamps", () => {
    expect(getPickFeedStatus({ ...input, now: 116_000 }).state).toBe("stale");
    expect(getPickFeedStatus({ ...input, checkedAt: null }).state).toBe("waiting");
    expect(getPickFeedStatus({ ...input, paused: true }).state).toBe("paused");
    expect(getPickFeedStatus({ ...input, checkedAt: 300_000 }).state).toBe("waiting");
  });
});

describe("missing pick resource guard", () => {
  it("does not clear an existing draft because draft metadata still says pre_draft", () => {
    expect(canAcceptEmptyPickResponse(true, undefined)).toBe(true);
    expect(canAcceptEmptyPickResponse(true, [])).toBe(true);
    expect(canAcceptEmptyPickResponse(false, [])).toBe(false);
    expect(canAcceptEmptyPickResponse(true, [{ pick_no: 1, round: 1, draft_slot: 1, player_id: "one" }])).toBe(false);
  });
});
