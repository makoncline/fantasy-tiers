import type { DraftedPlayer, ScoringType } from "./schemas";
import { normalizePosition } from "./util";
import type { CombinedEntryT } from "./schemas-aggregates";
import { FANTASY_POSITIONS } from "./scoring";

function toNum(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(/[,%]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

// Build a scoring-specific players map from the combined aggregates JSON
export function buildPlayersMapFromCombined(
  combined: Record<string, CombinedEntryT>,
  scoringType: ScoringType
): Record<string, DraftedPlayer & Record<string, unknown>> {
  const fpKey =
    scoringType === "ppr"
      ? "ppr"
      : scoringType === "half"
      ? "half"
      : "standard";
  const adpKey =
    scoringType === "ppr"
      ? "adp_ppr"
      : scoringType === "half"
      ? "adp_half_ppr"
      : "adp_std";
  const ptsKey =
    scoringType === "ppr"
      ? "pts_ppr"
      : scoringType === "half"
      ? "pts_half_ppr"
      : "pts_std";

  const out: Record<string, DraftedPlayer & Record<string, unknown>> = {};

  for (const [playerId, entry] of Object.entries(combined)) {
    const pos = normalizePosition(entry.position);
    if (!pos || !FANTASY_POSITIONS.has(pos)) continue;

    const rankTier = entry.borischen?.[scoringType] ?? null;
    const rank = rankTier ? toNum(rankTier.rank) : null;
    const tier = rankTier ? toNum(rankTier.tier) : null;

    const sleeperStats = {
      adp: entry.sleeper.stats[adpKey],
      pts: entry.sleeper.stats[ptsKey],
    };

    const fpStatsGroup = entry.fantasypros?.stats?.[fpKey];
    const fpRanksGroup =
      entry.fantasypros?.rankings?.[fpKey] ?? entry.fantasypros?.rankings;

    out[playerId] = {
      scoringType,
      player_id: playerId,
      name: entry.name,
      position: pos,
      team: entry.team,
      bye_week: entry.bye_week?.toString() ?? null,
      rank,
      tier,
      borischen: rank != null && tier != null ? { rank, tier } : null,
      sleeper: {
        ...entry.sleeper,
        stats: sleeperStats,
      },
      fantasypros: entry.fantasypros
        ? {
            ...entry.fantasypros,
          }
        : null,
    };
  }

  return out;
}
