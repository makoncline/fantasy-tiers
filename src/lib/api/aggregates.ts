import type { CombinedEntryT, CombinedShardT } from "../schemas-aggregates";
import { CombinedShard } from "../schemas-aggregates";

// Export derived types for use throughout the application
export type MergedAggregates = Record<string, CombinedEntryT>;
export type ShardAggregates = CombinedShardT;

export async function fetchMergedAggregates(): Promise<MergedAggregates> {
  const res = await fetch("/api/players", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch merged aggregates: ${res.statusText}`);
  }
  const json = await res.json();
  return CombinedShard.parse(json);
}

export async function fetchShard(
  pos: "ALL" | "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX"
): Promise<ShardAggregates> {
  const res = await fetch(
    `/api/aggregates/shard?pos=${encodeURIComponent(pos)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch ${pos} shard: ${res.statusText}`);
  }
  const json = await res.json();
  try {
    return CombinedShard.parse(json);
  } catch (error) {
    console.error(`fetchShard parse error for ${pos}:`, error);
    throw error;
  }
}
