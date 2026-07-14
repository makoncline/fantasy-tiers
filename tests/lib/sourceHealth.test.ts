import { describe, expect, it } from "vitest";
import { loadMergedCombinedAggregates } from "@/lib/combinedAggregates";
import { getAggregateSourceHealth } from "@/lib/sourceHealth";
import type { CombinedEntryT } from "@/lib/schemas-aggregates";

function player(
  id: string,
  options: {
    adp: number;
    projected?: boolean;
    fantasypros?: boolean;
    tier?: boolean;
  }
) {
  return {
    player_id: id,
    name: `player ${id}`,
    position: "RB",
    team: null,
    bye_week: null,
    tiers: {
      std: null,
      ppr: null,
      half: options.tier ? { rank: Number(id), tier: 1 } : null,
    },
    sleeper: {
      stats: {
        adp_std: options.adp,
        adp_half_ppr: options.adp,
        adp_ppr: options.adp,
        ...(options.projected
          ? { pts_std: 10, pts_half_ppr: 12, pts_ppr: 14 }
          : {}),
      },
      week: null,
      player: {
        injury_body_part: null,
        injury_notes: null,
        injury_start_date: null,
        injury_status: null,
      },
      updated_at: "2026-06-30T12:00:00.000Z",
    },
    fantasypros: options.fantasypros
      ? {
          player_id: id,
          player_owned_avg: null,
          pos_rank: null,
          stats: { standard: {}, ppr: {}, half: {} },
          rankings: {},
        }
      : null,
  } satisfies CombinedEntryT;
}

describe("getAggregateSourceHealth", () => {
  it("summarizes current aggregate sources for the draft assistant", () => {
    const players = Object.values(loadMergedCombinedAggregates());
    const health = getAggregateSourceHealth({
      scoring: "half",
      players,
      now: new Date("2026-07-01T12:00:00.000Z"),
    });

    expect(health.scoring).toBe("half");
    expect(health.sources.map((source) => source.source)).toEqual([
      "Sleeper",
      "FantasyPros",
      "Tiers",
    ]);
    expect(
      health.sources.every((source) =>
        ["ok", "warning", "missing"].includes(source.status)
      )
    ).toBe(true);
    expect(health.sources.find((source) => source.source === "FantasyPros"))
      .toMatchObject({
        source: "FantasyPros",
        projectionsFetched: expect.any(Boolean),
      });
  });

  it("ignores unranked Sleeper player-universe rows for ADP coverage", () => {
    const players = [
      player("1", { adp: 10, projected: true }),
      player("2", { adp: 20, projected: true }),
      player("3", { adp: 30, projected: true }),
      player("4", { adp: 40, projected: true }),
      player("5", { adp: 50, projected: true }),
      ...Array.from({ length: 20 }, (_, index) =>
        player(`9${index}`, { adp: 999 })
      ),
    ];

    const health = getAggregateSourceHealth({
      scoring: "half",
      players,
      draftCapacity: 5,
      now: new Date("2026-07-01T12:00:00.000Z"),
    });
    const sleeper = health.sources.find((source) => source.source === "Sleeper");

    expect(sleeper).toMatchObject({
      rowCount: 25,
      relevantRowCount: 5,
      coveragePct: 100,
      coverageBasis: "ADP among top 5 draft slots",
      status: "ok",
    });
    expect(sleeper?.warnings).not.toContain(
      "Sleeper ADP coverage is below 80% for draft-relevant players."
    );
  });

  it("warns when draft-relevant Sleeper players are missing ADP", () => {
    const players = [
      player("1", { adp: 10, projected: true }),
      player("2", { adp: 999, fantasypros: true, tier: true }),
      player("3", { adp: 999, tier: true }),
      player("4", { adp: 999 }),
    ];

    const health = getAggregateSourceHealth({
      scoring: "half",
      players,
      draftCapacity: 3,
      now: new Date("2026-07-01T12:00:00.000Z"),
    });
    const sleeper = health.sources.find((source) => source.source === "Sleeper");

    expect(sleeper).toMatchObject({
      rowCount: 4,
      relevantRowCount: 3,
      coveragePct: 33,
      coverageBasis: "ADP among top 3 draft slots",
      status: "warning",
    });
    expect(sleeper?.warnings).toContain(
      "Sleeper ADP coverage is below 80% for draft-relevant players."
    );
  });

  it("uses only the selected scoring mode and warns when data is stale", () => {
    const candidate = player("1", { adp: 10, tier: true });
    candidate.sleeper.stats.adp_half_ppr = 999;
    candidate.sleeper.stats.adp_ppr = 12;

    const health = getAggregateSourceHealth({
      scoring: "half",
      players: [candidate],
      draftCapacity: 1,
      now: new Date("2026-07-10T12:00:00.000Z"),
    });
    const sleeper = health.sources.find((source) => source.source === "Sleeper");

    expect(sleeper).toMatchObject({
      relevantRowCount: 1,
      coveragePct: 0,
      status: "warning",
    });
    expect(sleeper?.warnings).toContain("Sleeper data is more than 7 days old.");
  });
});
