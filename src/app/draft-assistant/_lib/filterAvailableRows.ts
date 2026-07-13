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
  // If showUnranked is false, include only players with Tier rank OR drafted (drafted override)
  const eligible = opts.showUnranked
    ? rows
    : rows.filter((r) => typeof r.tier_rank === "number" || isDrafted(r));

  // If showDrafted is false, remove drafted
  const finalRows = opts.showDrafted
    ? eligible
    : eligible.filter((r) => !isDrafted(r));

  // sort by Tier rank
  return finalRows.sort(
    (a, b) =>
      (Number(a.tier_rank ?? 1e9) as number) -
      (Number(b.tier_rank ?? 1e9) as number)
  );
}
