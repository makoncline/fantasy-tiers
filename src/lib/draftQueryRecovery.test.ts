import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { fetchDraftPicks } from "./draftPicks";
import { canAcceptEmptyPickResponse } from "./draftLiveState";
import type { DraftPick } from "./schemas";

const key = ["test-draft-recovery", "room"] as const;
const first: DraftPick = { player_id: "one", pick_no: 1, round: 1, draft_slot: 1 };
const second: DraftPick = { player_id: "two", pick_no: 2, round: 1, draft_slot: 2 };
const clients: QueryClient[] = [];
function client() {
  const value = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(value); return value;
}
afterEach(() => { clients.splice(0).forEach(value => value.clear()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const options = { queryKey: key, staleTime: 0,
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchDraftPicks("room", { signal }),
};

describe("real query-cache recovery contract", () => {
  it("retains the last full board and reports an error when HTTP fails", async () => {
    const cache = client(); cache.setQueryData(key, [first, second]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(cache.fetchQuery(options)).rejects.toThrow();
    expect(cache.getQueryData(key)).toEqual([first, second]);
    expect(cache.getQueryState(key)?.status).toBe("error");
  });
  it("accepts a later authoritative shorter prefix after an undo", async () => {
    const cache = client(); cache.setQueryData(key, [first, second]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([first])));
    await cache.fetchQuery(options);
    expect(cache.getQueryData(key)).toEqual([first]);
  });
  it("does not treat stale pre-draft metadata as permission to clear known picks", async () => {
    const cache = client(); cache.setQueryData(key, [first]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(cache.fetchQuery({ ...options, queryFn: ({ signal }) => fetchDraftPicks("room", {
      signal, allowEmptyPreDraft: canAcceptEmptyPickResponse(true, cache.getQueryData<DraftPick[]>(key)),
    }) })).rejects.toThrow();
    expect(cache.getQueryData(key)).toEqual([first]);
  });
  it("cancels an older request before a replacement so its late response cannot replace the new board", async () => {
    const cache = client(); cache.setQueryData(key, [first]);
    let finish: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; })));
    const older = cache.fetchQuery(options);
    // Query v5 returns the cached data on cancellation with revert enabled.
    const olderReverted = expect(older).resolves.toEqual([first]);
    await cache.cancelQueries({ queryKey: key });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([first, second])));
    await cache.fetchQuery(options);
    if (!finish) throw new Error("The first request did not start");
    finish(Response.json([first]));
    await olderReverted; await Promise.resolve();
    expect(cache.getQueryData(key)).toEqual([first, second]);
  });
});
