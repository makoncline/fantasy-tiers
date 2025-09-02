import type { Position } from "./schemas";

export const SEASON_WEEKS = 18;

// Position constants for consistent filtering
export const POSITION_SET = new Set<Position>([
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
]);
export const FLEX_POSITIONS = ["RB", "WR", "TE"] as const;
