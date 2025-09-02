// src/lib/playerRows.ts
import { z } from "zod";
import type { PositionEnum } from "./schemas";
import type { EnrichedPlayer } from "./enrichPlayers";
import { normalizePlayerName, ecrToRoundPick, normalizePosition } from "./util";

export type PlayerRow = {
  player_id: string;
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
  team: string | null;
  bye_week: number | null;
  rank?: number | undefined;
  tier?: number;
  bc_rank?: number;
  bc_tier?: number;
  fp_pts?: number | null;
  ecr_round_pick?: string | undefined;
  fp_tier?: number | null;
  fp_value?: number | null;
  fp_remaining_value_pct?: number | null | undefined;
  // Additional fields from EnrichedPlayer
  sleeper_pts?: number | null;
  sleeper_adp?: number | null;
  sleeper_rank_overall?: number | null;
  fp_adp?: number | null;
  fp_rank_overall?: number | null;
  fp_rank_pos?: number | null;
  fp_baseline_pts?: number | null;
  fp_player_owned_avg?: number | null;
  market_delta?: number | null;
  // Extra fields for beer sheets integration
  val?: number | null;
  ps?: number | null;
};

// Extras from BeerSheets for VAL/PS if available
export type Extras = Record<
  string,
  { val?: number; ps?: number; ecr_round_pick?: string }
>;

// Coerce arbitrary player-like records into PlayerRow (for legacy compatibility)
const PlayerLikeSchema = z.object({
  player_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  position: z.string().optional(),
  pos: z.string().optional(),
  rank: z.union([z.number(), z.string()]).optional(),
  tier: z.union([z.number(), z.string()]).optional(),
  team: z.string().optional(),
  pro_team: z.string().optional(),
  nfl_team: z.string().optional(),
  bye_week: z.union([z.number(), z.string()]).optional(),
  bye: z.union([z.number(), z.string()]).optional(),
  player: z
    .object({
      id: z.string().optional(),
      full_name: z.string().optional(),
      position: z.string().optional(),
      rank: z.union([z.number(), z.string()]).optional(),
      tier: z.union([z.number(), z.string()]).optional(),
      team: z.string().optional(),
      bye_week: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
});

/**
 * Convert EnrichedPlayer[] to PlayerRow[] for UI components
 */
export function toPlayerRows(
  enriched: EnrichedPlayer[],
  extras: Extras = {},
  leagueTeams?: number
): PlayerRow[] {
  return enriched
    .map((p): PlayerRow | null => {
      const rawPos = p.position;
      const position = normalizePosition(rawPos);

      // Skip players with invalid positions (shouldn't happen with enriched data)
      if (!position) {
        console.warn(
          `Skipping player with invalid position: ${rawPos} for ${p.name}`
        );
        return null;
      }

      // Get extras by player_id or normalized name
      const extrasById = extras[p.player_id];
      const extrasByName = extras[normalizePlayerName(p.name)];
      const playerExtras = extrasById || extrasByName || {};

      const result: PlayerRow = {
        player_id: p.player_id,
        name: p.name,
        position,
        team: p.team,
        bye_week: p.bye_week,
        sleeper_pts: p.sleeper_pts,
        sleeper_adp: p.sleeper_adp,
        sleeper_rank_overall: p.sleeper_rank_overall,
        fp_pts: p.fp_pts,
        fp_adp: p.fp_adp,
        fp_rank_overall: p.fp_rank_overall,
        fp_rank_pos: p.fp_rank_pos,
        fp_tier: p.fp_tier,
        fp_baseline_pts: p.fp_baseline_pts,
        fp_value: p.fp_value,
        fp_remaining_value_pct: p.fp_remaining_value_pct,
        fp_player_owned_avg: p.fp_player_owned_avg,
        market_delta: p.market_delta,
      };

      // Add optional properties only if they have values
      if (p.bc_rank != null) {
        result.rank = p.bc_rank;
        result.bc_rank = p.bc_rank;
      }
      if (p.bc_tier != null) {
        result.tier = p.bc_tier;
        result.bc_tier = p.bc_tier;
      }
      if (playerExtras.ecr_round_pick) {
        result.ecr_round_pick = playerExtras.ecr_round_pick;
      } else if (p.fp_rank_overall != null && leagueTeams) {
        // Calculate ecr_round_pick from fantasypros data if not provided in extras
        result.ecr_round_pick =
          ecrToRoundPick(Number(p.fp_rank_overall), leagueTeams) || undefined;
      }
      if (playerExtras.val !== undefined) {
        result.val = playerExtras.val;
      }
      if (playerExtras.ps !== undefined) {
        result.ps = playerExtras.ps;
      }

      return result;
    })
    .filter((row): row is PlayerRow => row !== null);
}

/**
 * Legacy function to convert arbitrary player-like records to PlayerRow[]
 * This is kept for backward compatibility but should be replaced with toPlayerRows()
 */
export function mapToPlayerRow(
  anyPlayers: unknown[],
  extrasByPlayerId?: Extras
): PlayerRow[] {
  const arr = (Array.isArray(anyPlayers) ? anyPlayers : []).flatMap((p) => {
    const res = PlayerLikeSchema.safeParse(p);
    return res.success ? [res.data] : [];
  });

  return arr.map((p) => {
    const nested = p.player ?? {};
    const name =
      p.name ??
      p.full_name ??
      nested.full_name ??
      (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : "—");
    const pid = p.player_id ?? p.id ?? String(nested.id ?? "");
    const extrasById =
      extrasByPlayerId && pid ? extrasByPlayerId[pid] : undefined;
    const extrasByName =
      extrasByPlayerId && name
        ? extrasByPlayerId[normalizePlayerName(name)]
        : undefined;
    const extras = extrasById || extrasByName || {};

    const result: PlayerRow = {
      player_id: pid,
      name,
      position: (p.position ??
        p.pos ??
        nested.position ??
        "QB") as PlayerRow["position"],
      team: p.team ?? p.pro_team ?? p.nfl_team ?? nested.team ?? null,
      bye_week:
        typeof p.bye_week === "number"
          ? p.bye_week
          : typeof p.bye === "number"
          ? p.bye
          : typeof nested.bye_week === "number"
          ? nested.bye_week
          : null,
    };

    // Add optional properties only if they have values
    const rank =
      typeof p.rank === "number"
        ? p.rank
        : typeof nested.rank === "number"
        ? nested.rank
        : undefined;
    if (rank !== undefined) {
      result.rank = rank;
    }

    const tier =
      typeof p.tier === "number"
        ? p.tier
        : typeof nested.tier === "number"
        ? nested.tier
        : undefined;
    if (tier !== undefined) {
      result.tier = tier;
    }

    if (extras.ecr_round_pick) {
      result.ecr_round_pick = extras.ecr_round_pick;
    }
    if (extras.val !== undefined) {
      result.val = extras.val;
    }
    if (extras.ps !== undefined) {
      result.ps = extras.ps;
    }

    return result;
  });
}

// New functions for bundle data mapping
import type { AggregatesBundlePlayerT } from "./schemas-bundle";

/**
 * Convert AggregatesBundlePlayer to PlayerRow for UI components
 */
export function toPlayerRowFromBundle(
  p: AggregatesBundlePlayerT,
  leagueTeams?: number
): PlayerRow {
  // Parse pos_rank to get numeric rank if possible
  let fp_rank_pos: number | null = null;
  if (p.fantasypros.pos_rank) {
    const match = p.fantasypros.pos_rank.match(/^[A-Z]+(\d+)$/);
    if (match && match[1]) {
      fp_rank_pos = parseInt(match[1], 10);
    }
  }

  const result: PlayerRow = {
    player_id: p.player_id,
    name: p.name,
    position: p.position as PlayerRow["position"],
    team: p.team,
    bye_week: p.bye_week,
    // Always carry rank field (can be null) for downstream expectations
    rank: p.borischen.rank ?? undefined,
    ...(typeof p.borischen.rank === "number"
      ? { bc_rank: p.borischen.rank }
      : {}),
    ...(p.borischen.tier ? { bc_tier: p.borischen.tier } : {}),
    fp_pts: p.fantasypros.pts,
    fp_tier: p.fantasypros.tier,
    fp_rank_overall: p.fantasypros.ecr,
    fp_rank_pos,
    fp_baseline_pts: p.fantasypros.baseline_pts,
    fp_value: p.calc.value,
    // Preserve null for tests/filters expecting explicit null
    fp_remaining_value_pct: p.calc.positional_scarcity as
      | number
      | null
      | undefined,
    fp_player_owned_avg: p.fantasypros.player_owned_avg,
    sleeper_pts: p.sleeper.pts,
    sleeper_adp: p.sleeper.adp,
    sleeper_rank_overall: p.sleeper.rank,
    fp_adp: p.fantasypros.adp,
    market_delta: p.calc.market_delta,
  };

  // Add tier if borischen tier exists
  if (p.borischen.tier != null) {
    result.tier = p.borischen.tier;
  }

  // Calculate ecr_round_pick if not provided and we have the data
  if (p.fantasypros.ecr_round_pick) {
    result.ecr_round_pick = p.fantasypros.ecr_round_pick;
  } else if (p.fantasypros.ecr && leagueTeams) {
    result.ecr_round_pick =
      ecrToRoundPick(p.fantasypros.ecr, leagueTeams) || undefined;
  }

  return result;
}

/**
 * Convert array of AggregatesBundlePlayer to PlayerRow[] for UI components
 */
export function toPlayerRowsFromBundle(
  arr: AggregatesBundlePlayerT[],
  leagueTeams?: number
): PlayerRow[] {
  return arr
    .map((p) => toPlayerRowFromBundle(p, leagueTeams))
    .sort((a, b) => (a.bc_rank ?? 999999) - (b.bc_rank ?? 999999));
}
