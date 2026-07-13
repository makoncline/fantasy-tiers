import type { Config } from "@libsql/client";
import { count, sql } from "drizzle-orm";
import { createRatingHistoryDb } from "./db";
import { migrateRatingHistoryDb } from "./migrate";
import {
  historyPlayers,
  playerRatingVersions,
  sourceRuns,
  type NewHistoryPlayer,
  type NewPlayerRatingVersion,
  type NewSourceRun,
} from "./schema";

const BATCH_SIZE = 100;

function chunks<T>(rows: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    result.push(rows.slice(index, index + BATCH_SIZE));
  }
  return result;
}

async function tableCounts(db: ReturnType<typeof createRatingHistoryDb>) {
  const [players, runs, versions] = await Promise.all([
    db.select({ value: count() }).from(historyPlayers),
    db.select({ value: count() }).from(sourceRuns),
    db.select({ value: count() }).from(playerRatingVersions),
  ]);
  return {
    players: players[0]?.value ?? 0,
    sourceRuns: runs[0]?.value ?? 0,
    versions: versions[0]?.value ?? 0,
  };
}

export async function backfillRatingHistory(
  sourceConfig: Config,
  targetConfig: Config
) {
  const source = createRatingHistoryDb(sourceConfig);
  const target = createRatingHistoryDb(targetConfig);
  try {
    await migrateRatingHistoryDb(target);
    const sourceCounts = await tableCounts(source);
    const targetBefore = await tableCounts(target);
    const [players, runs, versions] = await Promise.all([
      source.select().from(historyPlayers),
      source.select().from(sourceRuns),
      source.select().from(playerRatingVersions),
    ]);

    if (targetBefore.sourceRuns > 0 || targetBefore.versions > 0) {
      const countsComplete =
        targetBefore.players >= sourceCounts.players &&
        targetBefore.sourceRuns >= sourceCounts.sourceRuns &&
        targetBefore.versions >= sourceCounts.versions;
      const [targetPlayers, targetRuns, targetVersions] = await Promise.all([
        target.select({ playerId: historyPlayers.playerId }).from(historyPlayers),
        target.select({ id: sourceRuns.id, contentHash: sourceRuns.contentHash }).from(sourceRuns),
        target
          .select({ id: playerRatingVersions.id, valueHash: playerRatingVersions.valueHash })
          .from(playerRatingVersions),
      ]);
      const targetPlayerIds = new Set(targetPlayers.map((row) => row.playerId));
      const targetRunHashes = new Map(
        targetRuns.map((row) => [row.id, row.contentHash])
      );
      const targetVersionHashes = new Map(
        targetVersions.map((row) => [row.id, row.valueHash])
      );
      const contentComplete =
        players.every((row) => targetPlayerIds.has(row.playerId)) &&
        runs.every((row) => targetRunHashes.get(row.id) === row.contentHash) &&
        versions.every(
          (row) => targetVersionHashes.get(row.id) === row.valueHash
        );
      if (!countsComplete || !contentComplete) {
        throw new Error(
          "Target history database is partially populated or incompatible; refusing an ID-preserving backfill"
        );
      }
      return { source: sourceCounts, target: targetBefore, imported: false };
    }

    for (const batch of chunks<NewHistoryPlayer>(players)) {
      await target
        .insert(historyPlayers)
        .values(batch)
        .onConflictDoUpdate({
          target: historyPlayers.playerId,
          set: {
            name: sql`excluded.name`,
            position: sql`excluded.position`,
            team: sql`excluded.team`,
            byeWeek: sql`excluded.bye_week`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
    for (const batch of chunks<NewSourceRun>(runs)) {
      await target.insert(sourceRuns).values(batch).onConflictDoNothing();
    }
    for (const batch of chunks<NewPlayerRatingVersion>(versions)) {
      await target
        .insert(playerRatingVersions)
        .values(batch)
        .onConflictDoNothing();
    }

    const targetAfter = await tableCounts(target);
    if (
      targetAfter.players < sourceCounts.players ||
      targetAfter.sourceRuns < sourceCounts.sourceRuns ||
      targetAfter.versions < sourceCounts.versions
    ) {
      throw new Error("Rating history backfill count verification failed");
    }
    return { source: sourceCounts, target: targetAfter, imported: true };
  } finally {
    source.$client.close();
    target.$client.close();
  }
}
