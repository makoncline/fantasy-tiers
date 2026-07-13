import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { backfillRatingHistory } from "../../src/lib/ratingHistory/backfill";
import {
  createRatingHistoryDb,
  resolveRatingHistoryDatabaseConfig,
} from "../../src/lib/ratingHistory/db";
import { migrateRatingHistoryDb } from "../../src/lib/ratingHistory/migrate";
import {
  historyPlayers,
  playerRatingVersions,
  sourceRuns,
} from "../../src/lib/ratingHistory/schema";

function tempDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "history-deploy-"));
  return { dir, config: { url: `file:${path.join(dir, "history.db")}` } };
}

describe("rating history deployment", () => {
  it("uses local storage only outside production and requires remote credentials in production", () => {
    expect(resolveRatingHistoryDatabaseConfig({ NODE_ENV: "test" })).toMatchObject({
      available: true,
      storage: "local",
    });
    expect(
      resolveRatingHistoryDatabaseConfig({ NODE_ENV: "production" })
    ).toEqual({ available: false, reason: "not-configured" });
    expect(
      resolveRatingHistoryDatabaseConfig({
        NODE_ENV: "production",
        FANTASY_HISTORY_DATABASE_URL: "libsql://history.example.test",
      })
    ).toEqual({ available: false, reason: "auth-token-missing" });
    expect(
      resolveRatingHistoryDatabaseConfig({
        NODE_ENV: "production",
        FANTASY_HISTORY_DATABASE_URL: "libsql://history.example.test",
        FANTASY_HISTORY_DATABASE_AUTH_TOKEN: "secret",
      })
    ).toMatchObject({ available: true, storage: "remote" });
  });

  it("backfills an empty target once and verifies later runs idempotently", async () => {
    const source = tempDatabase();
    const target = tempDatabase();
    const db = createRatingHistoryDb(source.config);
    try {
      await migrateRatingHistoryDb(db);
      await db.insert(historyPlayers).values({ playerId: "p1", name: "Player One" });
      await db.insert(sourceRuns).values({
        id: 1,
        source: "fantasypros",
        mode: "draft",
        season: 2026,
        week: null,
        scoring: "half",
        position: "WR",
        fetchedAt: "2026-07-01T00:00:00.000Z",
        contentHash: "run-hash",
      });
      await db.insert(playerRatingVersions).values({
        id: 1,
        playerId: "p1",
        sourceRunId: 1,
        source: "fantasypros",
        mode: "draft",
        season: 2026,
        week: null,
        scoring: "half",
        positionScope: "WR",
        effectiveFrom: "2026-07-01T00:00:00.000Z",
        valueHash: "value-hash",
      });
    } finally {
      db.$client.close();
    }

    try {
      const first = await backfillRatingHistory(source.config, target.config);
      expect(first).toMatchObject({ imported: true, target: { versions: 1 } });
      const second = await backfillRatingHistory(source.config, target.config);
      expect(second).toMatchObject({ imported: false, target: { versions: 1 } });
    } finally {
      fs.rmSync(source.dir, { recursive: true, force: true });
      fs.rmSync(target.dir, { recursive: true, force: true });
    }
  });
});
