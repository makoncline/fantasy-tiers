import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchDraftDetails } from "../../src/lib/draftDetails";
import { fetchDraftPicks } from "../../src/lib/draftPicks";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchDraftDetails", () => {
  it("parses a valid response", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12345);
    const fetchMock = vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ draft_id: "123", metadata: { scoring_type: "ppr" }, settings: {} }),
    } as any);
    const d = await fetchDraftDetails("123");
    expect(d.draft_id).toBe("123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.sleeper.app/v1/draft/123?_=12345",
      { cache: "no-store" }
    );
  });

  it("treats null draft order fields as empty objects for pre-draft mocks", async () => {
    vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        draft_id: "mock-2026",
        metadata: { scoring_type: "std" },
        settings: { teams: 10, rounds: 15 },
        draft_order: null,
        slot_to_roster_id: null,
      }),
    } as any);

    const d = await fetchDraftDetails("mock-2026");

    expect(d.draft_order).toEqual({});
    expect(d.slot_to_roster_id).toEqual({});
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
    vi.spyOn(Date, "now").mockReturnValue(67890);
    const fetchMock = vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { draft_slot: 1, round: 1, pick_no: 1, player_id: "p1" },
        { draft_slot: 2, round: 1, pick_no: 2, player_id: "p2" },
      ],
    } as any);
    const picks = await fetchDraftPicks("123");
    expect(picks.length).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.sleeper.app/v1/draft/123/picks?_=67890",
      { cache: "no-store" }
    );
  });
});
