import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchDraftDetails } from "../../src/lib/draftDetails";
import { fetchDraftPicks } from "../../src/lib/draftPicks";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchDraftDetails", () => {
  it("parses a valid response", async () => {
    vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ draft_id: "123", metadata: { scoring_type: "ppr" }, settings: {} }),
    } as any);
    const d = await fetchDraftDetails("123");
    expect(d.draft_id).toBe("123");
  });

  it("throws on 404", async () => {
    vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" } as any);
    await expect(fetchDraftDetails("x")).rejects.toBeTruthy();
  });
});

describe("fetchDraftPicks", () => {
  it("returns [] on 404", async () => {
    vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" } as any);
    const picks = await fetchDraftPicks("123");
    expect(picks).toEqual([]);
  });

  it("parses array payload when available", async () => {
    vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { draft_slot: 1, round: 1, pick_no: 1, player_id: "p1" },
        { draft_slot: 2, round: 1, pick_no: 2, player_id: "p2" },
      ],
    } as any);
    const picks = await fetchDraftPicks("123");
    expect(picks.length).toBe(2);
  });
});
