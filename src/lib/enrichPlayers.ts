import type { ScoringType, Position } from "./schemas";
import type { CombinedEntryT } from "./schemas-aggregates";
import { scoringKeys, CORE_POSITIONS } from "./scoring";
import { normalizePosition } from "./util";

// League shape for enrichment inputs
export interface League {
  teams: number;
  scoring: ScoringType; // "std" | "half" | "ppr"
  roster: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    FLEX: number;
    BENCH: number; // unused in calculations, but part of shape
  };
}

// Enriched player with computed fields
export type EnrichedPlayer = CombinedEntryT & {
  bc_rank: number | null;
  bc_tier: number | null;
  sleeper_pts: number | null;
  sleeper_adp: number | null;
  sleeper_rank_overall: number | null;
  fp_pts: number | null;
  fp_adp: number | null;
  fp_rank_overall: number | null;
  fp_rank_pos: number | null;
  fp_tier: number | null;
  fp_baseline_pts: number;
  fp_value: number | null;
  fp_positional_scarcity: number;
  fp_replacement_slope: number;
  fp_scarcity_index: number;
  fp_positional_scarcity_slope: number;
  fp_player_owned_avg: number | null;
  market_delta: number | null;
};

type Pos = Position;

function toNum(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(/[,%]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

// Extractors from the combined aggregate entry
function getBoris(
  entry: CombinedEntryT,
  scoring: ScoringType
): { rank: number | null; tier: number | null } {
  const { borisKey } = scoringKeys(scoring);
  // Use only the matching key for scoring; QB/K/DEF are mirrored at build time.
  const bc = entry.borischen[borisKey];
  const rank = bc && typeof bc.rank !== "undefined" ? toNum(bc.rank) : null;
  const tier = bc && typeof bc.tier !== "undefined" ? toNum(bc.tier) : null;
  return { rank, tier };
}

function getSleeperPtsAdp(
  entry: CombinedEntryT,
  scoring: ScoringType
): { pts: number | null; adp: number | null } {
  const { sleeperSuffix } = scoringKeys(scoring);
  const stats = entry.sleeper.stats;
  const pts = toNum(stats[`pts_${sleeperSuffix}`]);
  const adp = toNum(stats[`adp_${sleeperSuffix}`]);
  return { pts, adp };
}

function getFpPts(entry: CombinedEntryT, scoring: ScoringType): number | null {
  const { fpKey } = scoringKeys(scoring);
  const grp = entry.fantasypros?.stats?.[fpKey];
  if (!grp) return null;
  return toNum(grp["FPTS_AVG"]);
}

function getFpRanks(
  entry: CombinedEntryT,
  scoring: ScoringType
): {
  ecrOverall: number | null;
  tier: number | null;
  posRank: number | null;
} {
  const { fpKey } = scoringKeys(scoring);
  const r = entry.fantasypros?.rankings?.[fpKey];
  const posRankStr = entry.fantasypros?.pos_rank;
  const posRankNum =
    typeof posRankStr === "string"
      ? Number(posRankStr.match(/^[A-Z]+(\d+)$/)?.[1] ?? "")
      : NaN;
  return {
    ecrOverall: toNum((r as Record<string, unknown>)?.rank_ecr),
    tier: toNum((r as Record<string, unknown>)?.tier),
    posRank: Number.isFinite(posRankNum) ? posRankNum : null,
  };
}

function getFpAdp(
  _entry: CombinedEntryT,
  _scoring: ScoringType
): number | null {
  // Placeholder until FantasyPros ADP is wired
  return null;
}

// Group players by position and sort by FP points (desc)
function groupByPosFpPts(
  players: CombinedEntryT[],
  scoring: ScoringType
): Record<Pos, { p: CombinedEntryT; pts: number }[]> {
  const by: Record<Pos, { p: CombinedEntryT; pts: number }[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DEF: [],
  };
  for (const p of players) {
    const raw = p.position;
    const pos = ((raw as string) === "DST" ? "DEF" : raw) as Pos;
    if (!CORE_POSITIONS.includes(pos)) continue;
    const pts = getFpPts(p, scoring);
    if (pts == null) continue;
    by[pos].push({ p, pts });
  }
  for (const pos of CORE_POSITIONS) by[pos].sort((a, b) => b.pts - a.pts);
  return by;
}

// Greedy allocation of FLEX across RB/WR/TE using the next-best FP points
function greedyFlexTake(
  by: Record<Pos, { p: CombinedEntryT; pts: number }[]>,
  flexSlots: number
): Record<"RB" | "WR" | "TE", number> {
  const take: Record<"RB" | "WR" | "TE", number> = { RB: 0, WR: 0, TE: 0 };
  const idx: Record<"RB" | "WR" | "TE", number> = { RB: 0, WR: 0, TE: 0 };
  for (let k = 0; k < Math.max(0, flexSlots); k++) {
    let best: "RB" | "WR" | "TE" | null = null;
    let bestPts = -Infinity;
    for (const pos of ["RB", "WR", "TE"] as const) {
      const i = idx[pos];
      const pts =
        by[pos] && i < by[pos].length && by[pos][i]
          ? by[pos][i].pts
          : -Infinity;
      if (pts > bestPts) {
        best = pos;
        bestPts = pts;
      }
    }
    if (best == null || bestPts === -Infinity) break;
    take[best] += 1;
    idx[best] += 1;
  }
  return take;
}

function computeFpBaselines(
  players: CombinedEntryT[],
  league: League,
  scoring: ScoringType
): Record<Pos, number> {
  const by = groupByPosFpPts(players, scoring);
  const flexTake = greedyFlexTake(
    by,
    (league.teams || 0) * (league.roster?.FLEX || 0)
  );
  const starters: Record<Pos, number> = {
    QB: (league.teams || 0) * (league.roster?.QB || 0),
    RB: (league.teams || 0) * (league.roster?.RB || 0) + flexTake.RB,
    WR: (league.teams || 0) * (league.roster?.WR || 0) + flexTake.WR,
    TE: (league.teams || 0) * (league.roster?.TE || 0) + flexTake.TE,
    K:
      (league.teams || 0) *
      (((league.roster as Record<string, unknown>)?.K as number) || 1),
    DEF:
      (league.teams || 0) *
      (((league.roster as Record<string, unknown>)?.DEF as number) ||
        ((league.roster as Record<string, unknown>)?.DST as number) ||
        1),
  };
  const base: Record<Pos, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };
  for (const pos of CORE_POSITIONS) {
    const n = starters[pos];
    const lst = by[pos];
    if (!lst.length || n <= 0) {
      base[pos] = 0;
      continue;
    }
    const i = Math.min(Math.max(0, n - 1), lst.length - 1); // clamp
    base[pos] = lst[i]?.pts ?? 0;
  }
  return base;
}

// Per-player local scarcity: forward gap to the next best in-position (fallback to backward gap at tail)
function computeFpLocalScarcity(
  players: CombinedEntryT[],
  scoring: ScoringType
): Map<CombinedEntryT, number> {
  const by = groupByPosFpPts(players, scoring);
  const out = new Map<CombinedEntryT, number>();
  for (const pos of CORE_POSITIONS) {
    const lst = by[pos];
    for (let i = 0; i < lst.length; i++) {
      const cur = lst[i]?.pts ?? 0;
      const next = i + 1 < lst.length ? lst[i + 1]?.pts ?? null : null;
      const prev = i - 1 >= 0 ? lst[i - 1]?.pts ?? null : null;
      let gap = 0;
      if (next != null) gap = cur - next; // forward gap
      else if (prev != null) gap = prev - cur; // tail fallback
      if (gap < 0) gap = 0;
      const player = lst[i]?.p;
      if (player) {
        out.set(player, gap);
      }
    }
  }
  return out;
}

// Replacement slope (per-position): gap at the replacement boundary
function computeFpReplacementSlope(
  players: CombinedEntryT[],
  league: League,
  scoring: ScoringType
): Record<Pos, number> {
  const by = groupByPosFpPts(players, scoring);
  const flexTake = greedyFlexTake(
    by,
    (league.teams || 0) * (league.roster?.FLEX || 0)
  );
  const starters: Record<Pos, number> = {
    QB: (league.teams || 0) * (league.roster?.QB || 0),
    RB: (league.teams || 0) * (league.roster?.RB || 0) + flexTake.RB,
    WR: (league.teams || 0) * (league.roster?.WR || 0) + flexTake.WR,
    TE: (league.teams || 0) * (league.roster?.TE || 0) + flexTake.TE,
    K:
      (league.teams || 0) *
      (((league.roster as Record<string, unknown>)?.K as number) || 1),
    DEF:
      (league.teams || 0) *
      (((league.roster as Record<string, unknown>)?.DEF as number) ||
        ((league.roster as Record<string, unknown>)?.DST as number) ||
        1),
  };
  const slope: Record<Pos, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };
  for (const pos of CORE_POSITIONS) {
    const lst = by[pos].map((x) => x.pts);
    const r = starters[pos];
    if (!lst.length || r <= 0) {
      slope[pos] = 0;
      continue;
    }
    const i = Math.min(Math.max(0, r - 1), lst.length - 1);
    if (i + 1 < lst.length && lst[i] != null && lst[i + 1] != null)
      slope[pos] = lst[i]! - lst[i + 1]!;
    else if (i - 1 >= 0 && lst[i - 1] != null && lst[i] != null)
      slope[pos] = lst[i - 1]! - lst[i]!;
    else slope[pos] = 0;
  }
  return slope;
}

// Percentage of positive value remaining after a given player is taken.
// Uses positive value = max(0, pts - baseline) up to the starter threshold.
function computeRemainingPositiveValuePercent(
  players: CombinedEntryT[],
  league: League,
  scoring: ScoringType
): Map<string, number> {
  const by = groupByPosFpPts(players, scoring);
  const flexTake = greedyFlexTake(
    by,
    (league.teams || 0) * (league.roster?.FLEX || 0)
  );
  const starters: Record<Pos, number> = {
    QB: (league.teams || 0) * (league.roster?.QB || 0),
    RB: (league.teams || 0) * (league.roster?.RB || 0) + flexTake.RB,
    WR: (league.teams || 0) * (league.roster?.WR || 0) + flexTake.WR,
    TE: (league.teams || 0) * (league.roster?.TE || 0) + flexTake.TE,
    K:
      (league.teams || 0) *
      (((league.roster as Record<string, unknown>)?.K as number) || 1),
    DEF:
      (league.teams || 0) *
      (((league.roster as Record<string, unknown>)?.DEF as number) ||
        ((league.roster as Record<string, unknown>)?.DST as number) ||
        1),
  };

  const out = new Map<string, number>();
  for (const pos of CORE_POSITIONS) {
    const list = by[pos]; // sorted desc by pts
    if (!list.length) continue;

    const r = Math.max(0, starters[pos] - 1);
    const baseline = list[Math.min(r, list.length - 1)]?.pts ?? 0;
    const starterEnd = Math.min(starters[pos], list.length);
    const values = list
      .slice(0, starterEnd)
      .map((x) => Math.max(0, x.pts - baseline));
    const totalPool = values.reduce((a, b) => a + b, 0);
    if (totalPool <= 0) {
      for (const { p } of list) out.set(String(p.player_id), 0);
      continue;
    }
    // prefix sum to compute remaining AFTER taking player at index i
    const prefix: number[] = new Array(values.length + 1).fill(0);
    for (let i = 0; i < values.length; i++)
      prefix[i + 1] = (prefix[i] || 0) + (values[i] || 0);

    for (let i = 0; i < list.length; i++) {
      const pid = String(list[i]?.p?.player_id || "");
      if (!pid) continue;
      const start = Math.min(i + 1, values.length); // after taking this player
      const remaining =
        start < values.length
          ? (prefix[values.length] || 0) - (prefix[start] || 0)
          : 0;
      const pct = Math.round((remaining / totalPool) * 100);
      out.set(pid, pct);
    }
  }
  return out;
}

// Main enrichment: returns a new readonly array with flat computed fields added
export function enrichPlayers(
  players: ReadonlyArray<CombinedEntryT>,
  league: League
): readonly EnrichedPlayer[] {
  const scoring = league.scoring;
  const baselines = computeFpBaselines([...players], league, scoring);
  const replacementSlope = computeFpReplacementSlope(
    [...players],
    league,
    scoring
  );
  const localScarcity = computeFpLocalScarcity([...players], scoring);
  const remainingPct = computeRemainingPositiveValuePercent(
    [...players],
    league,
    scoring
  );

  // Precompute Sleeper ADPs and PTS for overall rank derivation
  const sleeperAdps = players
    .map((p) => getSleeperPtsAdp(p, scoring).adp)
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b);
  const sleeperPtsAll = players
    .map((p) => getSleeperPtsAdp(p, scoring).pts)
    .filter((x): x is number => x != null)
    .sort((a, b) => b - a);

  function overallRankFromAdp(adp: number | null): number | null {
    if (adp == null || sleeperAdps.length === 0) return null;
    for (let i = 0; i < sleeperAdps.length; i++)
      if (sleeperAdps[i] != null && adp <= sleeperAdps[i]!) return i + 1; // 1-based
    return sleeperAdps.length;
  }
  function overallRankFromPts(pts: number | null): number | null {
    if (pts == null || sleeperPtsAll.length === 0) return null;
    for (let i = 0; i < sleeperPtsAll.length; i++)
      if (sleeperPtsAll[i] != null && pts >= sleeperPtsAll[i]!) return i + 1; // 1-based
    return sleeperPtsAll.length;
  }

  return players
    .map((p): EnrichedPlayer | null => {
      const rawPos = p.position;
      const pos = normalizePosition(rawPos);

      // Skip players with invalid positions
      if (!pos) {
        console.warn(
          `Skipping player with invalid position: ${rawPos} for ${
            p.name || p.player_id
          }`
        );
        return null;
      }

      // Boris Chen
      const { rank: bc_rank, tier: bc_tier } = getBoris(p, scoring);

      // Sleeper
      const { pts: sleeper_pts, adp: sleeper_adp } = getSleeperPtsAdp(
        p,
        scoring
      );
      const sleeper_rank_overall =
        overallRankFromAdp(sleeper_adp) ?? overallRankFromPts(sleeper_pts);

      // FantasyPros
      const fp_pts = getFpPts(p, scoring);
      const fp_adp = getFpAdp(p, scoring);
      const {
        ecrOverall: fp_rank_overall,
        tier: fp_tier,
        posRank: fp_rank_pos,
      } = getFpRanks(p, scoring);
      const fp_baseline_pts = baselines[pos] ?? 0;
      // Allow negative values below baseline; round to whole number
      const fp_value =
        fp_pts == null ? null : Math.round(fp_pts - fp_baseline_pts);
      const local = localScarcity.get(p) ?? 0;
      const repl = replacementSlope[pos] ?? 0;
      const index = repl > 0 ? local / repl : 0; // dimensionless index
      // UI scarcity = percent of positive value remaining after this player is taken
      const fp_positional_scarcity_slope =
        remainingPct.get(String(p.player_id)) ?? 0;
      const fp_player_owned_avg = toNum(p.fantasypros?.player_owned_avg);
      // Market delta (MD): Sleeper ADP - FP ECR (whole number)
      const market_delta =
        sleeper_adp != null && fp_rank_overall != null
          ? Math.round(sleeper_adp - fp_rank_overall)
          : null;

      return {
        ...p,
        // borischen
        bc_rank,
        bc_tier,
        // sleeper
        sleeper_pts,
        sleeper_adp,
        sleeper_rank_overall,
        // fantasy pros
        fp_pts,
        fp_adp,
        fp_rank_overall,
        fp_rank_pos,
        fp_tier,
        fp_baseline_pts,
        fp_value,
        // expose detailed scarcity metrics
        fp_positional_scarcity: Math.round(local),
        fp_replacement_slope: Math.round(repl),
        fp_scarcity_index: index,
        fp_positional_scarcity_slope,
        fp_player_owned_avg,
        market_delta, // negative: market earlier than experts; positive: falls vs experts
      } as const;
    })
    .filter((player): player is EnrichedPlayer => player !== null);
}

// Removed default export to avoid ambiguous imports
