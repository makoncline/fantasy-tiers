// src/lib/normalizePick.ts
import { z } from "zod";
import type { PickMeta } from "@/lib/types.draft";

// Superset of possible fields we've seen from Sleeper/derivations.
const RawPickSchema = z.object({
  player_id: z.string().optional(),
  round: z.number().int().positive().optional(),
  pick_no: z.number().int().positive().optional(), // sometimes "overall"
  pick: z.number().int().positive().optional(), // alias for overall
  overall: z.number().int().positive().optional(),
  pick_in_round: z.number().int().positive().optional(),
  draft_slot: z.number().int().positive().optional(),
  slot: z.number().int().positive().optional(),
  picked_by: z.string().optional(),
  roster_id: z.union([z.number(), z.string()]).optional(),
  user_id: z.string().optional(),
  metadata: z
    .object({
      player_id: z.string().optional(),
      timestamp: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});

export type NormalizedPick = {
  playerId: string;
  meta: PickMeta;
};

export function normalizePick(
  input: unknown,
  opts?: { teams?: number }
): NormalizedPick | null {
  const parsed = RawPickSchema.safeParse(input);
  if (!parsed.success) return null;

  const p = parsed.data;
  const playerId = p.player_id ?? p.metadata?.player_id;
  if (!playerId) return null;

  const round = p.round;
  const roundPick = p.pick_in_round ?? p.draft_slot ?? p.slot;

  const overall =
    p.pick_no ??
    p.pick ??
    p.overall ??
    (round && roundPick && opts?.teams
      ? (round - 1) * opts.teams + roundPick
      : undefined);

  const drafterId =
    p.picked_by ??
    (typeof p.roster_id === "number" ? String(p.roster_id) : p.roster_id) ??
    p.user_id ??
    undefined;

  const ts =
    typeof p.metadata?.timestamp === "string"
      ? Number(p.metadata.timestamp)
      : typeof p.metadata?.timestamp === "number"
      ? p.metadata.timestamp
      : undefined;

  const slot = p.draft_slot ?? p.slot;

  const meta: PickMeta = {
    ...(overall !== undefined && { overall }),
    ...(round !== undefined && { round }),
    ...(roundPick !== undefined && { roundPick }),
    ...(drafterId !== undefined && { drafterId }),
    ...(slot !== undefined && { slot }),
    ...(ts !== undefined && { ts }),
  };

  return { playerId, meta };
}
