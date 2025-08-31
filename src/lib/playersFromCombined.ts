import { DraftedPlayer, ScoringType } from "./schemas";
import { normalizePosition } from "./util";

// Build a scoring-specific players map from the combined aggregates JSON
export function buildPlayersMapFromCombined(
  combined: Record<string, any>,
  scoringType: ScoringType
): Record<string, DraftedPlayer & Record<string, any>> {
  const fpKey = scoringType === "ppr" ? "ppr" : scoringType === "half" ? "half" : "standard";
  const adpKey = scoringType === "ppr" ? "adp_ppr" : scoringType === "half" ? "adp_half_ppr" : "adp_std";
  const ptsKey = scoringType === "ppr" ? "pts_ppr" : scoringType === "half" ? "pts_half_ppr" : "pts_std";

  const out: Record<string, DraftedPlayer & Record<string, any>> = {};
  const allowedPositions = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

  for (const [playerId, entry] of Object.entries(combined)) {
    const pos = normalizePosition(String((entry as any)?.position ?? ""));
    if (!allowedPositions.has(pos)) continue;

    const rankTier = (entry as any)?.borischen?.[scoringType] ?? null;
    const rank =
      typeof rankTier?.rank === "number"
        ? rankTier.rank
        : rankTier?.rank != null
        ? Number(rankTier.rank)
        : null;
    const tier =
      typeof rankTier?.tier === "number"
        ? rankTier.tier
        : rankTier?.tier != null
        ? Number(rankTier.tier)
        : null;

    const statsAny = (((entry as any)?.sleeper?.stats ?? {}) as Record<string, number>) || {};
    const sleeperStats = {
      adp: typeof statsAny[adpKey] === "number" ? statsAny[adpKey] : undefined,
      pts: typeof statsAny[ptsKey] === "number" ? statsAny[ptsKey] : undefined,
    };

    const fpStatsGroup = (entry as any)?.fantasypros?.stats?.[fpKey] ?? undefined;
    const fpRanksGroup =
      (entry as any)?.fantasypros?.rankings?.[fpKey] ?? (entry as any)?.fantasypros?.rankings ?? undefined;

    out[playerId] = {
      scoringType,
      player_id: String(playerId),
      name: String((entry as any)?.name ?? ""),
      position: pos,
      team: (entry as any)?.team ?? null,
      bye_week: (entry as any)?.bye_week ?? null,
      rank,
      tier,
      borischen: rank != null && tier != null ? { rank, tier } : null,
      sleeper: {
        ...((entry as any)?.sleeper ?? null),
        stats: sleeperStats,
      },
      fantasypros: (entry as any)?.fantasypros
        ? {
            player_id: (entry as any).fantasypros.player_id,
            player_owned_avg: (entry as any).fantasypros.player_owned_avg,
            pos_rank: (entry as any).fantasypros.pos_rank,
            stats: fpStatsGroup,
            rankings: fpRanksGroup,
          }
        : null,
    } as any;
  }

  return out;
}

