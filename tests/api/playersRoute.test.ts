import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetAggregatesCache } from "../../src/lib/combinedAggregates";
import { GET as playersGET } from "../../src/app/api/players/route";
import { NextRequest } from "next/server";

const sampleCombined = {
  "1": {
    name: "A QB",
    position: "QB",
    team: "KC",
    bye_week: 10,
    borischen: { ppr: { rank: 2, tier: 1 } },
    sleeper: { stats: { adp_ppr: 10.2, pts_ppr: 340 } },
    fantasypros: { player_id: "fp1", player_owned_avg: 99, pos_rank: 1, stats: { ppr: { x: 1 } } },
  },
  "2": {
    name: "A RB",
    position: "RB",
    team: "SF",
    bye_week: 9,
    borischen: { ppr: { rank: 1, tier: 1 } },
    sleeper: { stats: { adp_ppr: 1.1, pts_ppr: 360 } },
  },
  "Z": { name: "Coach", position: "COACH", borischen: { ppr: { rank: 1, tier: 1 } } },
};

describe("/api/players route", () => {
  beforeEach(() => {
    vi.resetModules();
    resetAggregatesCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns scoring-filtered players map merged from shards", async () => {
    const existsSpy = vi.spyOn(require("fs"), "existsSync" as any).mockImplementation((p: string) => {
      return (
        String(p).includes("ALL-combined-aggregate.json") ||
        String(p).includes("RB-combined-aggregate.json")
      );
    });
    const readSpy = vi.spyOn(require("fs"), "readFileSync" as any).mockImplementation((p: string) => {
      const ps = String(p);
      if (ps.includes("ALL-combined-aggregate.json")) {
        return JSON.stringify({});
      }
      if (ps.includes("RB-combined-aggregate.json")) {
        return JSON.stringify(sampleCombined);
      }
      return JSON.stringify({});
    });

    const req = new NextRequest("http://localhost/api/players?scoring=ppr");
    const res = await playersGET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json["1"].position).toBe("QB");
    expect(json["2"].position).toBe("RB");
    expect(json["Z"]).toBeUndefined();

    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  it("400s on invalid scoring", async () => {
    const req = new NextRequest("http://localhost/api/players?scoring=xyz");
    const res = await playersGET(req);
    expect(res.status).toBe(400);
  });

  it("500s when aggregates missing", async () => {
    const existsSpy = vi.spyOn(require("fs"), "existsSync" as any).mockReturnValue(false);
    const req = new NextRequest("http://localhost/api/players?scoring=ppr");
    const res = await playersGET(req);
    expect(res.status).toBe(500);
    existsSpy.mockRestore();
  });
});
