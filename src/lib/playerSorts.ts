import { PlayerRow } from "./playerRows";

export function sortByBcRank(rows: PlayerRow[]): PlayerRow[] {
  return rows.slice().sort((a, b) => (a.bc_rank ?? 1e9) - (b.bc_rank ?? 1e9));
}

export function findBaseline(rows: PlayerRow[]): number | undefined {
  return rows.find((r) => typeof r.fp_baseline_pts === "number")
    ?.fp_baseline_pts;
}
