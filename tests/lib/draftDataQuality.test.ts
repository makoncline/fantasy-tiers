import { describe, expect, it } from "vitest";
import { buildDraftDataQualityReport } from "../../src/lib/draftDataQuality";

const NOW = new Date("2026-07-13T16:00:00.000Z");

function player(index: number, options: { adp?: number; tier?: boolean } = {}) {
  const adp = options.adp ?? index + 1;
  const tier = options.tier === false ? null : { rank: index + 1, tier: 1 };
  return {
    player_id: String(index),
    name: `player ${index}`,
    position: "WR" as const,
    team: "DEN",
    bye_week: 12,
    tiers: { std: tier, half: tier, ppr: tier },
    sleeper: {
      stats: { adp_std: adp, adp_half_ppr: adp, adp_ppr: adp },
      week: null,
      player: {
        injury_body_part: null,
        injury_notes: null,
        injury_start_date: null,
        injury_status: null,
      },
      updated_at: NOW.getTime(),
    },
    fantasypros: {
      player_id: String(index),
      player_owned_avg: null,
      pos_rank: `WR${index + 1}`,
      stats: { standard: {}, half: {}, ppr: {} },
      rankings: {
        standard: { rank_ave: index + 1 },
        half: { rank_ave: index + 1 },
        ppr: { rank_ave: index + 1 },
      },
    },
  };
}

function input() {
  const all = Object.fromEntries(
    Array.from({ length: 300 }, (_, index) => [String(index), player(index)])
  );
  const one = { "0": player(0) };
  const sample = {
    included: 60,
    available: 90,
    coverage_pct: 66.7,
    last_updated: NOW.toISOString(),
  };
  return {
    mode: "draft",
    season: "2026",
    generatedAt: NOW,
    shards: {
      ALL: all,
      QB: one,
      RB: one,
      WR: one,
      TE: one,
      K: one,
      DEF: one,
      FLEX: one,
    },
    metadata: {
      expert_samples: {
        "fantasypros:STD:draft": sample,
        "fantasypros:HALF:draft": sample,
        "fantasypros:PPR:draft": sample,
      },
      tiers: { STD: { ALL: { last_updated: NOW.toISOString() } } },
    },
  };
}

describe("draft aggregate quality", () => {
  it("reports a healthy draft-relevant data set", () => {
    const report = buildDraftDataQualityReport(input());
    expect(report.status).toBe("healthy");
    expect(report.scoring.half).toMatchObject({
      ecrRows: 300,
      sleeperAdpCovered: 180,
      tierCovered: 180,
    });
    expect(report.errors).toEqual([]);
  });

  it("blocks wrong mode, stale sources, and collapsed ADP coverage", () => {
    const degraded = input();
    degraded.mode = "weekly";
    degraded.generatedAt = new Date("2026-08-01T16:00:00.000Z");
    degraded.shards.ALL = Object.fromEntries(
      Array.from({ length: 300 }, (_, index) => [
        String(index),
        player(index, { adp: 999 }),
      ])
    );
    const report = buildDraftDataQualityReport(degraded);
    expect(report.status).toBe("blocked");
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/mode is weekly/),
        expect.stringMatching(/Sleeper ADP covers only 0/),
        expect.stringMatching(/older than seven days/),
      ])
    );
  });
});
