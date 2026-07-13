// src/lib/playerRows.ts
import { z } from "zod";
import type {
  DraftActionLabel,
  DraftComebackLabel,
  DraftRecommendationComponentKey,
  DraftRecommendationConfidence,
  DraftRecommendationEdgeLabel,
  DraftRecommendationWeightProfileId,
  DraftSourceConfidence,
} from "./draftValue";
import type { EnrichedPlayer } from "./enrichPlayers";
import { normalizePlayerName, ecrToRoundPick, normalizePosition } from "./util";
import type {
  AggregatesBundlePlayerT,
  AggregatesBundleResponseT,
} from "./schemas-bundle";

export type PlayerRow = {
  player_id: string;
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
  team: string | null;
  bye_week: number | null;
  rank?: number | undefined;
  tier?: number;
  tier_rank?: number;
  tier_level?: number;
  position_tier_level?: number | null;
  fp_pts?: number | null;
  ecr_round_pick?: string | undefined;
  fp_tier?: number | null;
  fp_value?: number | null;
  fp_remaining_value_pct?: number | null | undefined;
  // Additional fields from EnrichedPlayer
  sleeper_pts?: number | null;
  sleeper_adp?: number | null;
  sleeper_adp_round_pick?: string | undefined;
  sleeper_rank_overall?: number | null;
  sleeper_rank_pos?: number | null;
  sleeper_tier_level?: number | null;
  sleeper_injury_status?: string | null;
  sleeper_injury_notes?: string | null;
  fp_adp?: number | null;
  fp_rank_overall?: number | null;
  fp_rank_ave?: number | null;
  fp_rank_std?: number | null;
  fp_rank_pos?: number | null;
  fp_baseline_pts?: number | null;
  fp_player_owned_avg?: number | null;
  fbg_rank?: number | null;
  fbg_tier?: number | null;
  fbg_rank_pos?: number | null;
  fbg_adp_consensus?: number | null;
  fbg_settings?: string;
  market_delta?: number | null;
  // Extra fields for beer sheets integration
  val?: number | null;
  ps?: number | null;
  // Dynamic draft-assistant fields
  draft_value_score?: number | null;
  draft_tier_cliff?: number | null;
  draft_adp_delta_rounds?: number | null;
  draft_comeback_probability?: number | null;
  draft_comeback_label?: DraftComebackLabel;
  draft_action_label?: DraftActionLabel;
  draft_urgency?: number | null;
  draft_room_demand?: number | null;
  draft_bench_policy?: number | null;
  draft_raw_component_scores?: Partial<
    Record<DraftRecommendationComponentKey, number>
  >;
  draft_component_weights?: Partial<
    Record<DraftRecommendationComponentKey, number>
  >;
  draft_weight_profile?: DraftRecommendationWeightProfileId;
  draft_weight_profile_label?: string;
  draft_component_scores?: Partial<
    Record<DraftRecommendationComponentKey, number>
  >;
  draft_component_labels?: string[];
  draft_recommendation_edge?: DraftRecommendationEdgeLabel;
  draft_recommendation_edge_detail?: string;
  draft_recommendation_pros?: string[];
  draft_recommendation_cons?: string[];
  draft_data_quality_notes?: string[];
  draft_recommendation_summary?: string;
  draft_recommendation_confidence?: DraftRecommendationConfidence | null;
  draft_recommendation_score_gap?: number | null;
  draft_same_tier_fallbacks?: number | null;
  draft_roster_fit?: number | null;
  draft_source_confidence?: DraftSourceConfidence;
  draft_missing_fields?: string[];
  draft_reason_labels?: string[];
  draft_reason_details?: string[];
  draft_recommendation_rank?: number | null;
};

export type Extras = Record<
  string,
  { val?: number; ps?: number; ecr_round_pick?: string }
>;

function adpToRoundPick(adp: number | null | undefined, teams?: number) {
  if (adp == null || adp >= 900 || !teams) return undefined;
  return ecrToRoundPick(Math.max(1, Math.round(adp)), teams) || undefined;
}

function draftableAdp(adp: number | null | undefined) {
  return adp == null || adp >= 900 ? null : adp;
}

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
        sleeper_adp: draftableAdp(p.sleeper_adp),
        sleeper_adp_round_pick: adpToRoundPick(p.sleeper_adp, leagueTeams),
        sleeper_rank_overall: p.sleeper_rank_overall,
        sleeper_injury_status: p.sleeper.player.injury_status,
        sleeper_injury_notes: p.sleeper.player.injury_notes,
        fp_pts: p.fp_pts,
        fp_adp: p.fp_adp,
        fp_rank_overall: p.fp_rank_overall,
        fp_rank_ave: p.fp_rank_ave,
        fp_rank_std: p.fp_rank_std,
        fp_rank_pos: p.fp_rank_pos,
        fp_tier: p.fp_tier,
        fp_baseline_pts: p.fp_baseline_pts,
        fp_value: p.fp_value,
        fp_remaining_value_pct: p.fp_remaining_value_pct,
        fp_player_owned_avg: p.fp_player_owned_avg,
        market_delta: p.market_delta,
      };

      // Add optional properties only if they have values
      if (p.tier_rank != null) {
        result.rank = p.tier_rank;
        result.tier_rank = p.tier_rank;
      }
      if (p.tier_level != null) {
        result.tier = p.tier_level;
        result.tier_level = p.tier_level;
      }
      if (playerExtras.ecr_round_pick) {
        result.ecr_round_pick = playerExtras.ecr_round_pick;
      } else if (p.fp_rank_ave != null && leagueTeams) {
        // Calculate ecr_round_pick from fantasypros data if not provided in extras
        result.ecr_round_pick =
          ecrToRoundPick(Number(p.fp_rank_ave), leagueTeams) || undefined;
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
    rank: p.tiers.rank ?? undefined,
    ...(typeof p.tiers.rank === "number"
      ? { tier_rank: p.tiers.rank }
      : {}),
    ...(p.tiers.tier ? { tier_level: p.tiers.tier } : {}),
    fp_pts: p.fantasypros.pts,
    fp_tier: p.fantasypros.tier,
    fp_rank_overall: p.fantasypros.ecr,
    fp_rank_ave: p.fantasypros.ecr_average,
    fp_rank_std: p.fantasypros.ecr_std,
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
    sleeper_adp: draftableAdp(p.sleeper.adp),
    sleeper_adp_round_pick: adpToRoundPick(p.sleeper.adp, leagueTeams),
    sleeper_rank_overall:
      p.sleeper.adp != null && p.sleeper.adp >= 900 ? null : p.sleeper.rank,
    sleeper_injury_status: p.sleeper.injuryStatus,
    sleeper_injury_notes: p.sleeper.injuryNotes,
    fp_adp: p.fantasypros.adp,
    ...(p.footballguys
      ? {
          fbg_rank: p.footballguys.rank,
          fbg_tier: p.footballguys.tier,
          fbg_rank_pos: p.footballguys.pos_rank,
          fbg_adp_consensus: p.footballguys.adp.consensus ?? null,
          fbg_settings: p.footballguys.settings,
        }
      : {}),
    market_delta: p.calc.market_delta,
  };

  // Add tier if tiers tier exists
  if (p.tiers.tier != null) {
    result.tier = p.tiers.tier;
  }

  // Calculate ecr_round_pick if not provided and we have the data
  if (p.fantasypros.ecr_round_pick) {
    result.ecr_round_pick = p.fantasypros.ecr_round_pick;
  } else if (p.fantasypros.ecr_average && leagueTeams) {
    result.ecr_round_pick =
      ecrToRoundPick(p.fantasypros.ecr_average, leagueTeams) || undefined;
  }

  return result;
}

/**
 * Convert array of AggregatesBundlePlayer to PlayerRow[] for UI components
 */
export function toPlayerRowsFromBundle(
  arr: AggregatesBundlePlayerT[],
  leagueTeams?: number,
  options: {
    tiersArePositionTiers?: boolean;
    positionTierByPlayerId?: ReadonlyMap<string, number | null>;
  } = {}
): PlayerRow[] {
  const rows = arr
    .map((p) => toPlayerRowFromBundle(p, leagueTeams))
    .map((row) => {
      const mappedPositionTier = options.positionTierByPlayerId?.get(
        row.player_id
      );
      const positionTier =
        mappedPositionTier !== undefined
          ? mappedPositionTier
          : options.tiersArePositionTiers
            ? (row.tier_level ?? null)
            : undefined;

      return positionTier === undefined
        ? row
        : { ...row, position_tier_level: positionTier };
    })
    .sort((a, b) => (a.tier_rank ?? 999999) - (b.tier_rank ?? 999999));

  return withSleeperDerivedPositionTiers(rows);
}

export function buildPositionTierMapFromBundle(
  bundle: AggregatesBundleResponseT
): Map<string, number | null> {
  const byPlayerId = new Map<string, number | null>();
  const positionShards = [
    bundle.shards.QB,
    bundle.shards.RB,
    bundle.shards.WR,
    bundle.shards.TE,
    bundle.shards.K,
    bundle.shards.DEF,
  ];

  for (const shard of positionShards) {
    for (const player of shard) {
      byPlayerId.set(player.player_id, player.tiers.tier);
    }
  }

  return byPlayerId;
}

function withSleeperDerivedPositionTiers(rows: PlayerRow[]): PlayerRow[] {
  const byPosition = new Map<PlayerRow["position"], PlayerRow[]>();
  for (const row of rows) {
    const group = byPosition.get(row.position) ?? [];
    group.push(row);
    byPosition.set(row.position, group);
  }

  const sleeperByPlayerId = new Map<
    string,
    { rankPos: number; tierLevel: number | null }
  >();

  for (const group of byPosition.values()) {
    const tierSizes = group
      .filter(
        (row): row is PlayerRow & { tier_rank: number; tier_level: number } =>
          typeof row.tier_rank === "number" &&
          typeof row.tier_level === "number"
      )
      .toSorted((a, b) => a.tier_rank - b.tier_rank)
      .reduce<Array<{ tier: number; count: number }>>((acc, row) => {
        const last = acc[acc.length - 1];
        if (last && last.tier === row.tier_level) {
          last.count += 1;
        } else {
          acc.push({ tier: row.tier_level, count: 1 });
        }
        return acc;
      }, []);

    const sleeperSorted = group
      .filter(
        (row): row is PlayerRow & { sleeper_rank_overall: number } =>
          typeof row.sleeper_rank_overall === "number"
      )
      .toSorted((a, b) => a.sleeper_rank_overall - b.sleeper_rank_overall);

    sleeperSorted.forEach((row, index) => {
      const rankPos = index + 1;
      let cumulative = 0;
      let tierLevel: number | null = null;
      for (const tierSize of tierSizes) {
        cumulative += tierSize.count;
        if (rankPos <= cumulative) {
          tierLevel = tierSize.tier;
          break;
        }
      }
      sleeperByPlayerId.set(row.player_id, { rankPos, tierLevel });
    });
  }

  return rows.map((row) => {
    const sleeper = sleeperByPlayerId.get(row.player_id);
    if (!sleeper) return row;
    return {
      ...row,
      sleeper_rank_pos: sleeper.rankPos,
      sleeper_tier_level: sleeper.tierLevel,
    };
  });
}
