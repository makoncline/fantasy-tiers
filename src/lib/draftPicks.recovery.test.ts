import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDraftPicks } from "./draftPicks";
const picks = [{ player_id: "synthetic-1", draft_slot: 4, pick_no: 1, round: 1 }];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("pick fetch failures must not become an empty draft", () => {
  it.each([500, 502, 503, 404])("rejects a blank HTTP %i response", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    await expect(fetchDraftPicks("room")).rejects.toThrow();
  });
  it("permits 404/204 only with explicit confirmed-pre-draft context", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    expect(await fetchDraftPicks("room", { allowEmptyPreDraft: true })).toEqual([]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(fetchDraftPicks("room")).rejects.toThrow();
    expect(await fetchDraftPicks("room", { allowEmptyPreDraft: true })).toEqual([]);
  });
  it.each([null, {}, [...picks, { player_id: "bad" }]])("rejects a malformed successful response (%j)", async payload => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(fetchDraftPicks("room")).rejects.toThrow();
  });
  it("passes through cancellation and rejects even a transport that ignores the abort", async () => {
    const controller = new AbortController();
    let release: (response: Response) => void = () => { throw new Error("No pending fetch"); };
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { release = resolve; }));
    vi.stubGlobal("fetch", fetcher);
    const pending = fetchDraftPicks("room", { signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow();
    controller.abort(); release(Response.json(picks));
    await rejected;
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal, cache: "no-store" });
  });
  it("accepts a valid empty response for an actual reset, without inventing a monotonic-count rule", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    expect(await fetchDraftPicks("room")).toEqual([]);
  });
});
