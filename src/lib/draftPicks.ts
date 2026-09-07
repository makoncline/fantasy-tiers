import type { DraftPick } from "./schemas";
import { DraftPicksSchema } from "./schemas";
import { normalizeLivePicks } from "./draftLiveState";

export type FetchDraftPicksOptions = {
  signal?: AbortSignal;
  /** Only confirmed pre_draft context with no cached picks may allow 404/204. */
  allowEmptyPreDraft?: boolean;
};

export async function fetchDraftPicks(draftId: string, options: FetchDraftPicksOptions = {}): Promise<DraftPick[]> {
  options.signal?.throwIfAborted();
  if (!draftId.trim()) throw new Error("A draft ID is required.");
  const url = new URL(`https://api.sleeper.app/v1/draft/${encodeURIComponent(draftId)}/picks`);
  url.searchParams.set("_", String(Date.now()));
  const response = await fetch(url.toString(), { cache: "no-store", ...(options.signal ? { signal: options.signal } : {}) });
  options.signal?.throwIfAborted();
  // A failed response is not an empty roster. Throw so React Query retains its
  // previous data and exposes the error. Never consume a 500 body as an array.
  if (options.allowEmptyPreDraft && (response.status === 404 || response.status === 204)) return [];
  if (!response.ok || response.status === 204) throw new Error("The draft pick feed is unavailable.");
  const payload: unknown = await response.json();
  options.signal?.throwIfAborted();
  const normalized = normalizeLivePicks(payload);
  // Keep the repository's canonical external-data schema at the boundary.
  return DraftPicksSchema.parse(normalized);
}
