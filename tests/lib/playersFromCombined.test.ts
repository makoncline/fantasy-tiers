import { describe, it, expect } from "vitest";
import { buildPlayersMapFromCombined } from "../../src/lib/playersFromCombined";

const combinedSample: Record<string, any> = {
  "1": {
    name: "Test QB",
    position: "QB",
    team: "NYJ",
    bye_week: 7,
    borischen: { ppr: { rank: 10, tier: 2 }, half: { rank: 11, tier: 2 }, std: { rank: 12, tier: 3 } },
    sleeper: { stats: { adp_ppr: 50.5, adp_half_ppr: 51.5, adp_std: 52.5, pts_ppr: 300, pts_half_ppr: 280, pts_std: 260 } },
    fantasypros: { player_id: "fp1", player_owned_avg: 75, pos_rank: 8, stats: { ppr: { x: 1 }, half: { x: 2 }, standard: { x: 3 } }, rankings: { ppr: { r: 1 } } },
  },
  "2": {
    name: "Test RB",
    position: "RB",
    team: "SF",
    bye_week: 9,
    borischen: { ppr: { rank: 1, tier: 1 } },
    sleeper: { stats: { adp_ppr: 1.2, pts_ppr: 350 } },
  },
  "X": { name: "Kicker", position: "K", borischen: { ppr: { rank: 1, tier: 1 } }, sleeper: { stats: { adp_ppr: 120, pts_ppr: 120 } } },
  "Y": { name: "Defense", position: "DEF", borischen: { ppr: { rank: 5, tier: 2 } }, sleeper: { stats: { adp_ppr: 150, pts_ppr: 90 } } },
  "Z": { name: "Coach", position: "COACH", borischen: { ppr: { rank: 1, tier: 1 } } }, // should be filtered out
};

describe("buildPlayersMapFromCombined", () => {
  it("filters to allowed positions and maps fields for ppr", () => {
    const out = buildPlayersMapFromCombined(combinedSample, "ppr");
    expect(Object.keys(out)).toContain("1");
    expect(Object.keys(out)).toContain("2");
    expect(Object.keys(out)).toContain("X");
    expect(Object.keys(out)).toContain("Y");
    expect(Object.keys(out)).not.toContain("Z");

    const rb = out["2"];
    expect(rb.position).toBe("RB");
    expect(rb.borischen).toEqual({ rank: 1, tier: 1 });
    expect(rb.sleeper?.stats?.adp).toBe(1.2);
    expect(rb.sleeper?.stats?.pts).toBe(350);
  });

  it("uses correct fp/adp/pts keys for std and half", () => {
    const std = buildPlayersMapFromCombined(combinedSample, "std");
    const qbStd = std["1"];
    expect(qbStd.sleeper?.stats?.adp).toBe(52.5);
    expect(qbStd.sleeper?.stats?.pts).toBe(260);

    const half = buildPlayersMapFromCombined(combinedSample, "half");
    const qbHalf = half["1"];
    expect(qbHalf.sleeper?.stats?.adp).toBe(51.5);
    expect(qbHalf.sleeper?.stats?.pts).toBe(280);
  });
});
