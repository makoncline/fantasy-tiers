import type { PlayerWithPick } from "@/lib/types.draft";

export function isDraftedRow(r: PlayerWithPick): boolean {
  // Use the authoritative pick overlay
  return r.picked ? true : false;
}

export function filterUndrafted(rows: PlayerWithPick[]): PlayerWithPick[] {
  return rows.filter((r) => !isDraftedRow(r));
}
