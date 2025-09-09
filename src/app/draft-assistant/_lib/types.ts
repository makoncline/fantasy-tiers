export const POSITIONS = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"] as const;
export type Position = (typeof POSITIONS)[number];
