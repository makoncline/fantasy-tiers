import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

export const DEFAULT_PLAYER_ID_CACHE_PATH =
  "data/footballguys-player-ids.json";

const PlayerIdCacheEntrySchema = z.object({
  footballguysId: z.string().min(1),
  label: z.string().optional(),
  name: z.string().optional(),
  position: z.string().optional(),
  sleeperId: z.string().optional(),
  source: z.string().min(1),
  updatedAt: z.string(),
});

const PlayerIdCacheSchema = z
  .object({
    version: z.literal(1),
    updatedAt: z.string(),
    bySleeperId: z.record(z.string(), PlayerIdCacheEntrySchema),
    byNamePosition: z.record(z.string(), PlayerIdCacheEntrySchema),
  })
  .default({
    version: 1,
    updatedAt: new Date(0).toISOString(),
    bySleeperId: {},
    byNamePosition: {},
  });

export type PlayerIdCache = z.infer<typeof PlayerIdCacheSchema>;
export type PlayerIdCacheEntry = z.infer<typeof PlayerIdCacheEntrySchema>;

export function loadPlayerIdCache(cachePath = DEFAULT_PLAYER_ID_CACHE_PATH) {
  if (!existsSync(cachePath)) {
    return PlayerIdCacheSchema.parse(undefined);
  }
  return PlayerIdCacheSchema.parse(
    JSON.parse(readFileSync(cachePath, "utf8"))
  );
}

export async function savePlayerIdCache(
  cache: PlayerIdCache,
  cachePath = DEFAULT_PLAYER_ID_CACHE_PATH
) {
  const next = {
    ...cache,
    updatedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(next, null, 2), "utf8");
}

export function lookupPlayerIdCache(
  cache: PlayerIdCache,
  player: { name: string; position?: string | undefined; sleeperId?: string | undefined }
) {
  if (player.sleeperId) {
    const entry = cache.bySleeperId[String(player.sleeperId)];
    if (entry) return entry;
  }
  return cache.byNamePosition[namePositionKey(player.name, player.position)];
}

export function upsertPlayerIdCache(
  cache: PlayerIdCache,
  entry: {
    footballguysId: string;
    label?: string | undefined;
    name?: string | undefined;
    position?: string | undefined;
    sleeperId?: string | undefined;
    source: string;
  }
) {
  const updated: PlayerIdCacheEntry = {
    footballguysId: entry.footballguysId,
    source: entry.source,
    updatedAt: new Date().toISOString(),
  };
  if (entry.label) updated.label = entry.label;
  if (entry.name) updated.name = entry.name;
  if (entry.position) updated.position = entry.position;
  if (entry.sleeperId) updated.sleeperId = String(entry.sleeperId);
  if (updated.sleeperId) {
    cache.bySleeperId[updated.sleeperId] = updated;
  }
  if (updated.name) {
    cache.byNamePosition[namePositionKey(updated.name, updated.position)] =
      updated;
  }
}

export function namePositionKey(
  name: string,
  position: string | undefined
) {
  return `${normalizeName(name)}|${positionLabel(position)}`;
}

export function positionLabel(position: string | undefined) {
  if (position === "DEF") return "TD";
  if (position === "K") return "PK";
  return position ?? "";
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
