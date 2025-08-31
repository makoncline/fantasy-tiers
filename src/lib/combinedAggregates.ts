import fs from "fs";
import path from "path";

export function tryLoadJson(filePath: string): Record<string, any> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, any>;
  } catch {
    // ignore corrupted files
  }
  return null;
}

let _cache: { data: Record<string, any>; ts: number } | null = null;

export function resetAggregatesCache() {
  _cache = null;
}

export function loadMergedCombinedAggregates(ttlMs: number = Number(process.env.AGGREGATES_CACHE_MS || 600_000)) {
  // Disable cache in tests to avoid interference
  if (process.env.NODE_ENV !== "test" && _cache && Date.now() - _cache.ts < ttlMs) {
    return _cache.data;
  }
  const positions = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF", "FLEX"] as const;
  const baseDirs = [
    path.resolve(process.cwd(), "public/data/aggregates"),
    path.resolve(process.cwd(), "public/data/aggregate"),
  ];
  const merged: Record<string, any> = {};
  for (const dir of baseDirs) {
    for (const pos of positions) {
      const fp = path.join(dir, `${pos}-combined-aggregate.json`);
      const json = tryLoadJson(fp);
      if (!json) continue;
      for (const [id, entry] of Object.entries(json)) {
        const existing = merged[id] || {};
        merged[id] = { ...existing, ...(entry as any) };
      }
    }
  }
  _cache = { data: merged, ts: Date.now() };
  return merged;
}
