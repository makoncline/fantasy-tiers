import * as fs from "fs";
import * as path from "path";
import { CombinedShard, CombinedEntry } from "./schemas-aggregates";
import type { CombinedEntryT } from "./schemas-aggregates";

let _cache: { data: Record<string, CombinedEntryT>; ts: number } | null = null;

export function resetAggregatesCache() {
  _cache = null;
}

// Server-only version for API routes
export function getAggregatesLastModifiedServer(): number | null {
  if (_cache) return _cache.ts;

  try {
    let latest = 0;
    const dir = path.resolve(process.cwd(), "public/data/aggregate");
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith("-combined-aggregate.json")) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        latest = Math.max(latest, stats.mtime.getTime());
      }
    }
    return latest || null;
  } catch {
    return null;
  }
}

export function loadMergedCombinedAggregates(
  ttlMs: number = Number(process.env.AGGREGATES_CACHE_MS || 600_000)
): Record<string, CombinedEntryT> {
  if (_cache && Date.now() - _cache.ts < ttlMs) {
    return _cache.data;
  }
  const positions = [
    "ALL",
    "QB",
    "RB",
    "WR",
    "TE",
    "K",
    "DEF",
    "FLEX",
  ] as const;
  const dir = path.resolve(process.cwd(), "public/data/aggregate");
  const merged: Record<string, CombinedEntryT> = {};

  for (const pos of positions) {
    const file = path.join(dir, `${pos}-combined-aggregate.json`);
    if (!fs.existsSync(file)) continue;

    try {
      const json = JSON.parse(fs.readFileSync(file, "utf-8"));
      const shard = CombinedShard.parse(json); // strict validation
      for (const [id, entry] of Object.entries(shard)) {
        // Shards share the same entry shape; last one wins where overlapping.
        merged[id] = CombinedEntry.parse({ ...(merged[id] ?? {}), ...entry });
      }
    } catch (error) {
      // Skip corrupted files
      console.warn(`Skipping corrupted file ${file}:`, error);
    }
  }

  _cache = { data: merged, ts: Date.now() };
  return merged;
}
