import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetAggregatesCache } from "../../src/lib/combinedAggregates";
import { GET as playersGET } from "../../src/app/api/players/route";
import { NextRequest } from "next/server";

const sampleCombined = {
  "1": {
    player_id: "1",
    name: "A QB",
    position: "QB",
    team: "KC",
    bye_week: 10,
    borischen: {
      std: null,
      ppr: { rank: 2, tier: 1 },
      half: null,
    },
    sleeper: {
      stats: {
        adp_std: 10.5,
        adp_half_ppr: 10.2,
        adp_ppr: 10.2,
        pts_ppr: 340,
      },
      week: null,
      player: {
        injury_body_part: null,
        injury_notes: null,
        injury_start_date: null,
        injury_status: null,
      },
      updated_at: null,
    },
    fantasypros: {
      player_id: "fp1",
      player_owned_avg: 99,
      pos_rank: 1,
      stats: { ppr: { x: 1 } },
      rankings: {},
    },
  },
  "2": {
    player_id: "2",
    name: "A RB",
    position: "RB",
    team: "SF",
    bye_week: 9,
    borischen: {
      std: null,
      ppr: { rank: 1, tier: 1 },
      half: null,
    },
    sleeper: {
      stats: {
        adp_std: 1.2,
        adp_half_ppr: 1.1,
        adp_ppr: 1.1,
        pts_ppr: 360,
      },
      week: null,
      player: {
        injury_body_part: null,
        injury_notes: null,
        injury_start_date: null,
        injury_status: null,
      },
      updated_at: null,
    },
    fantasypros: null,
  },
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
    const existsSpy = vi
      .spyOn(require("fs"), "existsSync" as any)
      .mockImplementation((p: string) => {
        return (
          String(p).includes("ALL-combined-aggregate.json") ||
          String(p).includes("RB-combined-aggregate.json")
        );
      });
    const readSpy = vi
      .spyOn(require("fs"), "readFileSync" as any)
      .mockImplementation((p: string) => {
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
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toBeDefined();
    // Should return players data with default 'std' scoring

    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  it("returns properly typed data structure with core positions", async () => {
    const comprehensiveSample = {
      qb1: {
        player_id: "qb1",
        name: "QB Player",
        position: "QB",
        team: "KC",
        bye_week: 10,
        borischen: {
          std: { rank: 1, tier: 1 },
          ppr: null,
          half: null,
        },
        sleeper: {
          stats: {
            adp_std: 15.2,
            adp_half_ppr: 15.1,
            adp_ppr: 15.0,
          },
          week: null,
          player: {
            injury_body_part: null,
            injury_notes: null,
            injury_start_date: null,
            injury_status: null,
          },
          updated_at: null,
        },
        fantasypros: null,
      },
      rb1: {
        player_id: "rb1",
        name: "RB Player",
        position: "RB",
        team: "SF",
        bye_week: 9,
        borischen: {
          std: { rank: 1, tier: 1 },
          ppr: null,
          half: null,
        },
        sleeper: {
          stats: {
            adp_std: 5.2,
            adp_half_ppr: 5.1,
            adp_ppr: 5.0,
          },
          week: null,
          player: {
            injury_body_part: null,
            injury_notes: null,
            injury_start_date: null,
            injury_status: null,
          },
          updated_at: null,
        },
        fantasypros: null,
      },
      wr1: {
        player_id: "wr1",
        name: "WR Player",
        position: "WR",
        team: "GB",
        bye_week: 11,
        borischen: {
          std: { rank: 1, tier: 1 },
          ppr: null,
          half: null,
        },
        sleeper: {
          stats: {
            adp_std: 10.2,
            adp_half_ppr: 10.1,
            adp_ppr: 10.0,
          },
          week: null,
          player: {
            injury_body_part: null,
            injury_notes: null,
            injury_start_date: null,
            injury_status: null,
          },
          updated_at: null,
        },
        fantasypros: null,
      },
      te1: {
        player_id: "te1",
        name: "TE Player",
        position: "TE",
        team: "KC",
        bye_week: 10,
        borischen: {
          std: { rank: 1, tier: 1 },
          ppr: null,
          half: null,
        },
        sleeper: {
          stats: {
            adp_std: 20.2,
            adp_half_ppr: 20.1,
            adp_ppr: 20.0,
          },
          week: null,
          player: {
            injury_body_part: null,
            injury_notes: null,
            injury_start_date: null,
            injury_status: null,
          },
          updated_at: null,
        },
        fantasypros: null,
      },
      k1: {
        player_id: "k1",
        name: "K Player",
        position: "K",
        team: "NE",
        bye_week: 14,
        borischen: {
          std: { rank: 1, tier: 1 },
          ppr: null,
          half: null,
        },
        sleeper: {
          stats: {
            adp_std: 150.2,
            adp_half_ppr: 150.1,
            adp_ppr: 150.0,
          },
          week: null,
          player: {
            injury_body_part: null,
            injury_notes: null,
            injury_status: null,
            injury_start_date: null,
          },
          updated_at: null,
        },
        fantasypros: null,
      },
      def1: {
        player_id: "def1",
        name: "DEF Player",
        position: "DEF",
        team: null,
        bye_week: null,
        borischen: {
          std: { rank: 1, tier: 1 },
          ppr: null,
          half: null,
        },
        sleeper: {
          stats: {
            adp_std: 120.2,
            adp_half_ppr: 120.1,
            adp_ppr: 120.0,
          },
          week: null,
          player: {
            injury_body_part: null,
            injury_notes: null,
            injury_start_date: null,
            injury_status: null,
          },
          updated_at: null,
        },
        fantasypros: null,
      },
    };

    const existsSpy = vi
      .spyOn(require("fs"), "existsSync" as any)
      .mockImplementation((p: string) => {
        return String(p).includes("ALL-combined-aggregate.json");
      });
    const readSpy = vi
      .spyOn(require("fs"), "readFileSync" as any)
      .mockImplementation((p: string) => {
        return JSON.stringify(comprehensiveSample);
      });

    const req = new NextRequest("http://localhost/api/players");
    const res = await playersGET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toBeDefined();
    // Should return players data with default 'std' scoring

    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  it("400s on invalid scoring", async () => {
    const req = new NextRequest("http://localhost/api/players?scoring=xyz");
    const res = await playersGET(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 error when aggregates missing", async () => {
    const readSpy = vi
      .spyOn(require("fs"), "readFileSync" as any)
      .mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });
    const req = new NextRequest("http://localhost/api/players?scoring=ppr");
    const res = await playersGET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("FILE_LOAD_ERROR");
    expect(json.error.message).toContain(
      "Failed to load ALL combined aggregates"
    );
    readSpy.mockRestore();
  });
});
