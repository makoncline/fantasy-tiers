import { z } from "zod";
import { normalizePosition } from "./util";
import { getPlayersByScoringType } from "./getPlayers";
import {
  DraftedPlayer,
  PlayerWithRankingsSchema,
  RosterSlot,
  ScoringType,
} from "./schemas";

// New path for combined aggregates
export function getAggregateDataUrlPath(position: RosterSlot | "ALL"): string {
  return `/data/aggregates/${position}-combined-aggregate.json`;
}

// Adapter: combined entry -> PlayerWithRankings
function adaptCombinedToPlayerWithRankings(playerId: string, entry: any) {
  const adapted = {
    player_id: String(playerId),
    name: String(entry?.name ?? ""),
    position: normalizePosition(String(entry?.position ?? "")),
    team: entry?.team ?? null,
    bye_week: entry?.bye_week ?? null,
    rankingsByScoringType: {
      std: entry?.borischen?.std ?? null,
      ppr: entry?.borischen?.ppr ?? null,
      half: entry?.borischen?.half ?? null,
    },
  };
  return PlayerWithRankingsSchema.parse(adapted);
}

// Client-side function to load aggregate player data (from new combined files)
export async function loadAggregatePlayerDataClient(
  position: RosterSlot | "ALL" = "ALL"
): Promise<Record<string, z.infer<typeof PlayerWithRankingsSchema>>> {
  const url = getAggregateDataUrlPath(position);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load aggregate player data for ${position}`);
  }
  const combined: Record<string, any> = await response.json();
  const result: Record<string, z.infer<typeof PlayerWithRankingsSchema>> = {};
  for (const [playerId, entry] of Object.entries(combined)) {
    try {
      result[playerId] = adaptCombinedToPlayerWithRankings(playerId, entry);
    } catch {
      // skip invalid entries
    }
  }
  return result;
}

// Client-side function to get players by scoring type
export async function getPlayersByScoringTypeClient(
  scoringType: ScoringType,
  position: RosterSlot | "ALL" = "ALL"
) {
  const aggregatePlayerData = await loadAggregatePlayerDataClient(position);
  return getPlayersByScoringType(scoringType, aggregatePlayerData);
}

// New: get combined aggregates filtered for a scoring type with simplified sleeper/fantasypros blocks
export async function getCombinedPlayersByScoringTypeClient(
  scoringType: ScoringType,
  position: RosterSlot | "ALL" = "ALL"
): Promise<Record<string, DraftedPlayer & Record<string, any>>> {
  const url = getAggregateDataUrlPath(position);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load combined aggregates");
  const combined: Record<string, any> = await res.json();

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

  const out: Record<string, DraftedPlayer & Record<string, any>> = {};
  const allowedPositions = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
  for (const [playerId, entry] of Object.entries(combined)) {
    const pos = normalizePosition(String(entry?.position ?? ""));
    if (!allowedPositions.has(pos)) continue;
    // Use only the requested scoring type. Mirroring for QB/K/DEF
    // happens during aggregation, so no std fallback required here.
    const rankTier = entry?.borischen?.[scoringType] ?? null;
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
    const statsAny = (entry?.sleeper?.stats ?? {}) as Record<string, number>;
    const sleeperStats = {
      adp: typeof statsAny[adpKey] === "number" ? statsAny[adpKey] : undefined,
      pts: typeof statsAny[ptsKey] === "number" ? statsAny[ptsKey] : undefined,
    };
    const fpStatsGroup = entry?.fantasypros?.stats?.[fpKey] ?? undefined;
    const fpRanksGroup =
      entry?.fantasypros?.rankings?.[fpKey] ??
      entry?.fantasypros?.rankings ??
      undefined;
    out[playerId] = {
      scoringType,
      player_id: String(playerId),
      name: String(entry?.name ?? ""),
      position: pos,
      team: entry?.team ?? null,
      bye_week: entry?.bye_week ?? null,
      rank,
      tier,
      borischen: rank != null && tier != null ? { rank, tier } : null,
      sleeper: {
        ...entry?.sleeper,
        stats: sleeperStats,
      },
      fantasypros: entry?.fantasypros
        ? {
            player_id: entry.fantasypros.player_id,
            player_owned_avg: entry.fantasypros.player_owned_avg,
            pos_rank: entry.fantasypros.pos_rank,
            stats: fpStatsGroup,
            rankings: fpRanksGroup,
          }
        : null,
    } as any;
  }
  try {
    // eslint-disable-next-line no-console
    console.log("[combinedPlayers]", {
      scoringType,
      position,
      count: Object.keys(out).length,
      sample: Object.values(out).slice(0, 2),
    });
    const saquon =
      (out as any)["4866"] ||
      Object.values(out as any).find(
        (p: any) => String(p?.name || "").toLowerCase() === "saquon barkley"
      );
    if (saquon) {
      // eslint-disable-next-line no-console
      console.log("[combinedPlayers:saquon]", saquon);
    }
  } catch {}
  return out;
}
