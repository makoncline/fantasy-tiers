import { z } from "zod";

import {
  buildPositionTierMapFromBundle,
  toPlayerRowsFromBundle,
  type PlayerRow,
} from "@/lib/playerRows";
import type { AggregatesBundleResponseT } from "@/lib/schemas-bundle";
import { PositionEnum } from "@/lib/schemas";

const nullableFiniteNumber = z.number().finite().nullable();

export const DraftCandidateSchema = z.object({
  player_id: z.string().min(1),
  name: z.string().min(1),
  position: PositionEnum,
  team: z.string().nullable(),
  bye_week: z.string().nullable(),
  rank: nullableFiniteNumber,
  tier: nullableFiniteNumber,
  tier_rank: nullableFiniteNumber,
  tier_level: nullableFiniteNumber,
  position_tier_level: nullableFiniteNumber,
  sleeper_tier_level: nullableFiniteNumber,
  fp_rank_ave: nullableFiniteNumber,
  fp_rank_pos: nullableFiniteNumber,
  sleeper_adp: nullableFiniteNumber,
  sleeper_injury_status: z.string().nullable(),
  sleeper_injury_notes: z.string().nullable(),
});

export type DraftCandidate = z.infer<typeof DraftCandidateSchema>;

function validSleeperAdp(value: number | null | undefined) {
  return value == null || value >= 900 ? null : value;
}

export function draftCandidateFromPlayerRow(row: PlayerRow): DraftCandidate {
  return DraftCandidateSchema.parse({
    player_id: row.player_id,
    name: row.name,
    position: row.position,
    team: row.team,
    bye_week: row.bye_week == null ? null : String(row.bye_week),
    rank: row.tier_rank ?? row.rank ?? null,
    tier: row.tier_level ?? row.tier ?? null,
    tier_rank: row.tier_rank ?? row.rank ?? null,
    tier_level: row.tier_level ?? row.tier ?? null,
    position_tier_level: row.position_tier_level ?? null,
    sleeper_tier_level: row.sleeper_tier_level ?? null,
    fp_rank_ave: row.fp_rank_ave ?? null,
    fp_rank_pos: row.fp_rank_pos ?? null,
    sleeper_adp: validSleeperAdp(row.sleeper_adp),
    sleeper_injury_status: row.sleeper_injury_status ?? null,
    sleeper_injury_notes: row.sleeper_injury_notes ?? null,
  });
}

export function draftCandidateMapFromRows(
  rows: readonly PlayerRow[]
): Record<string, DraftCandidate> {
  return Object.fromEntries(
    rows.map((row) => {
      const candidate = draftCandidateFromPlayerRow(row);
      return [candidate.player_id, candidate];
    })
  );
}

export function draftCandidateMapFromBundle(
  bundle: AggregatesBundleResponseT
): Record<string, DraftCandidate> {
  const positionTierByPlayerId = buildPositionTierMapFromBundle(bundle);
  const rows = toPlayerRowsFromBundle(bundle.shards.ALL, bundle.teams, {
    positionTierByPlayerId,
  });
  return draftCandidateMapFromRows(rows);
}
