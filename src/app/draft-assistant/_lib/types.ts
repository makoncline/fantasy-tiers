export const POSITIONS = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"] as const;
export type Position = (typeof POSITIONS)[number];

export type DraftPickAction = {
  label?: string;
  disabled?: boolean;
  onPick: (player: { player_id: string }) => void;
};
