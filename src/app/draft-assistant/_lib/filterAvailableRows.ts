import type { PlayerRow } from "@/lib/playerRows";
import { normalizePlayerName } from "@/lib/util";

export type PositionFilter =
  | "ALL"
  | "RB"
  | "WR"
  | "TE"
  | "QB"
  | "RB/WR"
  | "K"
  | "DEF";

export interface FilterOptions {
  position: PositionFilter;
  showDrafted: boolean;
  showUnranked: boolean;
  draftedIds: Set<string>;
  draftedNames: Set<string>;
}

function isDrafted(
  row: PlayerRow,
  draftedIds: Set<string>,
  draftedNames: Set<string>
): boolean {
  const id = String(row.player_id);
  if (draftedIds.has(id)) return true;
  const nm = normalizePlayerName(row.name);
  return nm ? draftedNames.has(nm) : false;
}

export function filterAvailableRows(
  rows: PlayerRow[],
  opts: FilterOptions
): PlayerRow[] {
  // position filter first
  let filtered = rows;
  if (opts.position === "RB/WR") {
    filtered = rows.filter((r) => r.position === "RB" || r.position === "WR");
  } else if (opts.position !== "ALL") {
    filtered = rows.filter((r) => r.position === opts.position);
  }

  // If showUnranked is false, include only players with Boris rank OR drafted (drafted override)
  const eligible = opts.showUnranked
    ? filtered
    : filtered.filter(
        (r) =>
          typeof r.bc_rank === "number" ||
          isDrafted(r, opts.draftedIds, opts.draftedNames)
      );

  // If showDrafted is false, remove drafted
  const finalRows = opts.showDrafted
    ? eligible
    : eligible.filter((r) => !isDrafted(r, opts.draftedIds, opts.draftedNames));

  // sort by Boris rank
  return finalRows.sort(
    (a, b) =>
      (Number(a.bc_rank ?? 1e9) as number) -
      (Number(b.bc_rank ?? 1e9) as number)
  );
}
