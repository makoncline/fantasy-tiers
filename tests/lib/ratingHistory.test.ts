import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createRatingHistoryDb } from "../../src/lib/ratingHistory/db";
import { migrateRatingHistoryDb } from "../../src/lib/ratingHistory/migrate";
import { ingestAggregateHistory } from "../../src/lib/ratingHistory/ingestAggregates";
import {
  getPlayerRatingHistory,
  getRatingHistoryDashboard,
} from "../../src/lib/ratingHistory/dashboard";
import { getDropDecisionSignals } from "../../src/lib/ratingHistory/queries";
import type { CombinedEntryT } from "../../src/lib/schemas-aggregates";

function tempDbUrl() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fantasy-history-"));
  return {
    dir,
    url: `file:${path.join(dir, "history.db")}`,
  };
}

function makeEntry(overrides: Partial<CombinedEntryT> = {}): CombinedEntryT {
  return {
    player_id: "p1",
    name: "good player",
    position: "WR",
    team: "DEN",
    bye_week: 10,
    tiers: {
      std: { rank: 12, tier: 2 },
      half: { rank: 11, tier: 2 },
      ppr: { rank: 10, tier: 2 },
    },
    sleeper: {
      stats: {
        adp_std: 42,
        adp_half_ppr: 39,
        adp_ppr: 36,
        pts_std: 190,
        pts_half_ppr: 205,
        pts_ppr: 220,
      },
      week: null,
      player: {
        injury_body_part: null,
        injury_notes: null,
        injury_start_date: null,
        injury_status: null,
      },
      updated_at: 1780000000000,
    },
    fantasypros: {
      player_id: "fp1",
      player_owned_avg: 84.5,
      pos_rank: "WR14",
      stats: {
        standard: { FPTS: 198 },
        half: { FPTS: 210 },
        ppr: { FPTS: 222 },
      },
      rankings: {
        standard: { rank_ecr: 38, tier: 4 },
        half: { rank_ecr: 35, tier: 4 },
        ppr: { rank_ecr: 32, tier: 4 },
      },
    },
    ...overrides,
  };
}

describe("rating history ingest", () => {
  it("only inserts new player rating versions when tracked values change", async () => {
    const { dir, url } = tempDbUrl();
    const db = createRatingHistoryDb({ url });

    try {
      await migrateRatingHistoryDb(db);
      const initial = {
        shards: { WR: { p1: makeEntry() } },
        metadata: {
          tiers: {
            STD: {
              WR: {
                last_updated: "2026-06-30T14:00:00.000Z",
                fetched_at: "2026-06-30T15:00:00.000Z",
                year: 2026,
                row_count: 1,
              },
            },
          },
          fp: {
            STD: {
              WR: {
                last_updated: "2026-06-30T14:00:00.000Z",
                fetched_at: "2026-06-30T15:00:00.000Z",
                year: 2026,
                row_count: 1,
                mode: "draft",
              },
            },
          },
        },
      };

      const first = await ingestAggregateHistory(db, {
        ...initial,
        effectiveFrom: "2026-07-01T00:00:00.000Z",
      });
      expect(first.ratingVersionsInserted).toBeGreaterThan(0);
      expect(first.ratingVersionsUnchanged).toBe(0);

      const second = await ingestAggregateHistory(db, {
        ...initial,
        effectiveFrom: "2026-07-02T00:00:00.000Z",
      });
      expect(second.ratingVersionsInserted).toBe(0);
      expect(second.ratingVersionsUnchanged).toBeGreaterThan(0);

      const byeSuppressed = makeEntry({
        tiers: {
          std: null,
          half: { rank: 11, tier: 2 },
          ppr: { rank: 10, tier: 2 },
        },
      });
      const third = await ingestAggregateHistory(db, {
        shards: { WR: { p1: byeSuppressed } },
        metadata: initial.metadata,
        effectiveFrom: "2026-07-03T00:00:00.000Z",
      });
      expect(third.ratingVersionsClosed).toBe(1);
      expect(third.ratingVersionsInserted).toBe(1);

      const signals = await getDropDecisionSignals(db, {
        playerId: "p1",
        scoring: "std",
        position: "WR",
      });
      expect(signals.current.tiersPrimary?.sourceStatus).toBe("absent");
      expect(signals.lastPresent.tiersPrimary?.rankOverall).toBe(12);
      expect(signals.flags.currentlyMissingPrimaryTier).toBe(true);
      expect(signals.flags.hasDurableSleeperValue).toBe(true);
      expect(signals.flags.hasDurableFantasyProsValue).toBe(true);

      const dashboard = await getRatingHistoryDashboard(db);
      expect(dashboard.totals.totalPlayers).toBe(1);
      expect(dashboard.totals.currentAbsentRatings).toBe(1);
      expect(dashboard.totals.changedRatingScopes).toBe(1);
      expect(dashboard.missingWithPrior[0]?.playerId).toBe("p1");
      expect(dashboard.missingWithPrior[0]?.lastRankOverall).toBe(12);

      const playerHistory = await getPlayerRatingHistory(db, {
        query: "good",
      });
      expect(playerHistory.searchResults[0]?.playerId).toBe("p1");
      expect(playerHistory.selectedPlayer?.name).toBe("good player");
      expect(playerHistory.timeline.length).toBeGreaterThan(0);
      expect(playerHistory.timeline[0]?.sourceStatus).toBe("absent");
    } finally {
      db.$client.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
