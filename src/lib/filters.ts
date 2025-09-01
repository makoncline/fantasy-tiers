// src/lib/filters.ts
import { Position, CombinedEntryT } from "./schemas-aggregates";
import { FLEX_POSITIONS } from "./constants";

/**
 * Filter players by position with proper typing
 */
export function filterByPosition<T extends { position: Position }>(
  players: readonly T[],
  position: Position | "FLEX"
): readonly T[] {
  if (position === "FLEX") {
    return players.filter((player) =>
      FLEX_POSITIONS.includes(
        player.position as (typeof FLEX_POSITIONS)[number]
      )
    );
  }
  return players.filter((player) => player.position === position);
}

/**
 * Filter combined entries by position
 */
export function filterCombinedEntriesByPosition(
  entries: readonly CombinedEntryT[],
  position: Position | "FLEX"
): readonly CombinedEntryT[] {
  return filterByPosition(entries, position);
}
