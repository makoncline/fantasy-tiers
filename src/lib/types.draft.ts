// src/lib/types.draft.ts
import type { PlayerRow } from "@/lib/playerRows";

export type PickMeta = {
  overall?: number; // overall pick number, if derivable
  round?: number;
  roundPick?: number;
  drafterId?: string; // user/roster id who made the pick
  slot?: number;
  ts?: number; // timestamp (ms)
};

export type PlayerWithPick = PlayerRow & {
  draft_projected_points?: number | null;
  picked?: PickMeta;
  draftedByMe?: boolean;
};
