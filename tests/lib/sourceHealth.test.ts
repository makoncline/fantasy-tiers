import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { buildAggregateBundle } from "@/lib/aggregateBundle";
import {
  DEFAULT_DRAFT_ROSTER_SLOTS,
  DEFAULT_DRAFT_SCORING_RULES,
  rankingScoringFromRules,
} from "@/lib/draftLeagueConfig";
import { DraftSourceManifestSchema } from "@/lib/draftSourceManifest";
import {
  buildFantasyProsSourceHealth,
  buildSleeperSourceHealth,
} from "@/lib/sourceHealth";

describe("aggregate source health", () => {
  it("uses the deployed source manifest for both independent player universes", () => {
    const bundle = buildAggregateBundle({
      scoring: rankingScoringFromRules(DEFAULT_DRAFT_SCORING_RULES),
      teams: 12,
      rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
    });
    const sourceHealth = bundle.sourceHealth;

    expect(sourceHealth).toBeDefined();
    expect(sourceHealth?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "FantasyPros",
          status: "available",
          season: "2026",
        }),
        expect.objectContaining({
          source: "Sleeper",
          status: "available",
          season: "2026",
        }),
      ])
    );
    expect(sourceHealth?.fantasyProsPlayers.length).toBeGreaterThan(200);
    expect(sourceHealth?.sleeperPlayers.length).toBeGreaterThan(100);
    expect(
      sourceHealth?.sleeperPlayers.every(
        (player) => !player.name.startsWith("Sleeper player ")
      )
    ).toBe(true);
  });

  it("rejects a draft market from a different season", () => {
    const health = buildSleeperSourceHealth({
      players: [],
      projectionArtifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-04T12:00:00.000Z",
        sourceLastModified: "2026-09-04T11:00:00.000Z",
        players: {},
      },
      market: {
        season: "2025",
        fetchedAt: "2026-09-03T12:00:00.000Z",
        rankedPlayerCount: 100,
        matchedPlayerCount: 100,
      },
      marketPlayerCount: 100,
      marketTopPlayerCount: 100,
    });

    expect(health.status).toBe("missing");
    expect(health.season).toBeNull();
    expect(health.fetchedAt).toBe("2026-09-03T12:00:00.000Z");
    expect(health.problems).toContain(
      "Sleeper projection and draft-market seasons do not match."
    );
  });

  it("rejects a severely partial Sleeper draft market", () => {
    const health = buildSleeperSourceHealth({
      players: [],
      projectionArtifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-04T12:00:00.000Z",
        sourceLastModified: "2026-09-04T11:00:00.000Z",
        players: {},
      },
      market: {
        season: "2026",
        fetchedAt: "2026-09-04T12:00:00.000Z",
        rankedPlayerCount: 1,
        matchedPlayerCount: 1,
      },
      marketPlayerCount: 1,
      marketTopPlayerCount: 1,
    });

    expect(health.status).toBe("missing");
    expect(health.problems).toContain(
      "Sleeper draft market has fewer than 100 ranked players."
    );
  });

  it("rejects one unmatched player in the core Sleeper market slice", () => {
    const health = buildSleeperSourceHealth({
      players: [],
      projectionArtifact: {
        schemaVersion: 1,
        source: "Sleeper season projections",
        season: "2026",
        fetchedAt: "2026-09-04T12:00:00.000Z",
        sourceLastModified: "2026-09-04T11:00:00.000Z",
        players: {},
      },
      market: {
        season: "2026",
        fetchedAt: "2026-09-04T12:00:00.000Z",
        rankedPlayerCount: 139,
        matchedPlayerCount: 133,
      },
      marketPlayerCount: 133,
      marketTopPlayerCount: 119,
    });

    expect(health.status).toBe("missing");
    expect(health.problems).toContain(
      "Sleeper draft market matches 119/120 core players; 100% is required."
    );
  });

  it("rejects a partial market manifest before it is written", () => {
    const manifest = DraftSourceManifestSchema.parse(
      JSON.parse(
        fs.readFileSync(
          path.resolve("public/data/aggregate/draft-source-manifest.json"),
          "utf8"
        )
      )
    );
    const incomplete = {
      ...manifest,
      sleeperMarket: {
        ...manifest.sleeperMarket,
        boards: {
          ...manifest.sleeperMarket.boards,
          ppr: { rankedPlayerCount: 1, matchedPlayerCount: 1 },
        },
      },
      sleeper: {
        ...manifest.sleeper,
        ppr: manifest.sleeper.ppr.slice(0, 1),
      },
    };

    expect(DraftSourceManifestSchema.safeParse(incomplete).success).toBe(false);
  });

  it("rejects one required FantasyPros position with no source timestamp", () => {
    const complete = {
      fetched_at: "2026-09-04T12:00:00.000Z",
      last_updated: "2026-09-04T11:00:00.000Z",
      row_count: 100,
      year: "2026",
      experts: { included: 100, available: 120, coverage_pct: 83.3 },
    };
    const health = buildFantasyProsSourceHealth(
      {
        fp: {
          STD: { QB: complete, DST: complete },
          PPR: {
            RB: complete,
            WR: { ...complete, last_updated: null },
            TE: complete,
            FLEX: complete,
          },
        },
      },
      "ppr",
      DEFAULT_DRAFT_ROSTER_SLOTS,
      100
    );

    expect(health.status).toBe("missing");
    expect(health.lastUpdated).toBeNull();
    expect(health.problems).toContain(
      "FantasyPros source update time is missing."
    );
  });
});
