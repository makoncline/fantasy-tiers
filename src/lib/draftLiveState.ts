/** Draft-feed transport checks. These do not score players or infer opponent choices. */
export type FeedPick = { pick_no: number; draft_slot: number; round: number; player_id: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value
    : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** Normalize the whole response or reject it. Never drop malformed rows. */
export function normalizeLivePicks(value: unknown): FeedPick[] {
  if (!Array.isArray(value)) throw new Error("The pick feed did not return an array.");
  const rows = value.map((raw): FeedPick => {
    if (!record(raw)) throw new Error("The pick feed contains an invalid row.");
    const pick_no = positiveInteger(raw.pick_no ?? raw.pick ?? raw.p);
    const draft_slot = positiveInteger(raw.draft_slot ?? raw.draft_slot_no ?? raw.slot);
    const round = positiveInteger(raw.round ?? raw.r);
    const id = raw.player_id ?? raw.pid;
    const player_id = typeof id === "string" ? id
      : typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? String(id) : "";
    if (pick_no == null || draft_slot == null || round == null || !player_id.trim()) {
      throw new Error("The pick feed contains an incomplete row.");
    }
    return { pick_no, draft_slot, round, player_id };
  }).sort((a, b) => a.pick_no - b.pick_no);
  const ids = new Set<string>();
  for (const [index, row] of rows.entries()) {
    if (row.pick_no !== index + 1 || ids.has(row.player_id)) {
      throw new Error("The pick feed is not a complete, unique prefix.");
    }
    ids.add(row.player_id);
  }
  // A shorter VALID response can be a commissioner undo. Never reject it solely
  // because its count is smaller. Request cancellation handles old client work;
  // without a server revision we cannot prove an upstream response is newest.
  return rows;
}

export const PICK_FEED_STALE_MS = 15_000; // Operational limit: five normal 3s polls.
export type PickFeedStatus = {
  state: "waiting" | "checked" | "stale" | "error" | "paused" | "complete";
  label: string;
  warning: boolean;
  ageSeconds: number | null;
};
export function getPickFeedStatus(input: {
  checkedAt: number | null; now: number; hasError: boolean;
  paused?: boolean; complete?: boolean;
}): PickFeedStatus {
  const age = input.checkedAt != null && Number.isFinite(input.checkedAt) && input.checkedAt > 0
    && Number.isFinite(input.now) && input.checkedAt <= input.now + 1_000
    ? Math.max(0, input.now - input.checkedAt) : null;
  const ageSeconds = age == null ? null : Math.floor(age / 1_000);
  if (input.hasError) return { state: "error", label: "Pick update failed · check draft", warning: true, ageSeconds };
  if (input.paused) return { state: "paused", label: "Pick updates paused · check draft", warning: true, ageSeconds };
  if (input.complete) return { state: "complete", label: "Completed draft received", warning: false, ageSeconds };
  if (age == null) return { state: "waiting", label: "Waiting for pick feed", warning: true, ageSeconds };
  if (age > PICK_FEED_STALE_MS) return { state: "stale", label: "Pick feed not checked recently · check draft", warning: true, ageSeconds };
  return { state: "checked", label: `Pick feed checked ${ageSeconds}s ago`, warning: false, ageSeconds };
}

/** Missing-resource responses are empty only before any picks have been received. */
export function canAcceptEmptyPickResponse(confirmedPreDraft: boolean, previous: readonly FeedPick[] | undefined): boolean {
  return confirmedPreDraft && (previous == null || previous.length === 0);
}
