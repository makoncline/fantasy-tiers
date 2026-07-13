import type { PlayerRow } from "./playerRows";

export function sortByBcRank(rows: PlayerRow[]): PlayerRow[] {
  return rows.slice().sort((a, b) => (a.tier_rank ?? 1e9) - (b.tier_rank ?? 1e9));
}

export function findBaseline(rows: PlayerRow[]): number | undefined {
  return (
    rows.find((r) => r.fp_baseline_pts != null)?.fp_baseline_pts ?? undefined
  );
}
