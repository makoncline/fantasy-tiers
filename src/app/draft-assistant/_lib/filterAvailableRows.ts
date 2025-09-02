import type { PlayerWithPick } from "@/lib/types.draft";

export interface FilterOptions {
  showDrafted: boolean;
  showUnranked: boolean;
}

function isDrafted(row: PlayerWithPick): boolean {
  // Use the authoritative pick overlay
  return row.picked ? true : false;
}

export function filterAvailableRows(
  rows: PlayerWithPick[],
  opts: FilterOptions
): PlayerWithPick[] {
  // If showUnranked is false, include only players with Boris rank OR drafted (drafted override)
  const eligible = opts.showUnranked
    ? rows
    : rows.filter((r) => typeof r.bc_rank === "number" || isDrafted(r));

  // If showDrafted is false, remove drafted
  const finalRows = opts.showDrafted
    ? eligible
    : eligible.filter((r) => !isDrafted(r));

  // sort by Boris rank
  return finalRows.sort(
    (a, b) =>
      (Number(a.bc_rank ?? 1e9) as number) -
      (Number(b.bc_rank ?? 1e9) as number)
  );
}
