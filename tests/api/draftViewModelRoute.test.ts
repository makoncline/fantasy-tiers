import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as vmGET } from "../../src/app/api/draft/view-model/route";
import { resetAggregatesCache } from "../../src/lib/combinedAggregates";

afterEach(() => {
  vi.restoreAllMocks();
});
beforeEach(() => {
  resetAggregatesCache();
});

describe("/api/draft/view-model", () => {
  it("returns view-model using merged aggregates and sleeper data", async () => {
    // Mock fs via combinedAggregates loader
    vi.spyOn(require("fs"), "existsSync" as any).mockImplementation((p: string) => {
      return String(p).includes("RB-combined-aggregate.json");
    });
    vi.spyOn(require("fs"), "readFileSync" as any).mockImplementation(() => {
      return JSON.stringify({
        "p1": { name: "RB One", position: "RB", borischen: { ppr: { rank: 1, tier: 1 } }, sleeper: { stats: { adp_ppr: 1.2, pts_ppr: 300 } } },
        "p2": { name: "WR Two", position: "WR", borischen: { ppr: { rank: 2, tier: 1 } }, sleeper: { stats: { adp_ppr: 10.2, pts_ppr: 280 } } },
      });
    });

    // Mock fetch for draft details/picks
    vi.spyOn(global, "fetch" as any).mockImplementation((url: string) => {
      if (url.includes("/v1/draft/") && !url.endsWith("/picks")) {
        return Promise.resolve({ ok: true, json: async () => ({ draft_id: "d1", metadata: { scoring_type: "ppr" }, settings: { teams: 10, slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1, slots_k: 1, slots_def: 1, slots_flex: 1, rounds: 16 }, draft_order: { u1: 1 } }) } as any);
      }
      if (url.endsWith("/picks")) {
        return Promise.resolve({ ok: true, json: async () => ([{ draft_slot: 1, round: 1, pick_no: 1, player_id: "p2" }]) } as any);
      }
      return Promise.resolve({ ok: false, status: 404, text: async () => "" } as any);
    });

    const req = new NextRequest("http://localhost/api/draft/view-model?draft_id=d1&user_id=u1");
    const res = await vmGET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    // available excludes drafted p2
    const ids = (json.available || []).map((p: any) => p.player_id);
    expect(ids).toContain("p1");
    expect(ids).not.toContain("p2");
    expect(json.topAvailablePlayersByPosition).toBeTruthy();
  });
});
