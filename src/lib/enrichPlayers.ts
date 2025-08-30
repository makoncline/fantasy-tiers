import { ScoringType } from "./schemas";

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

type Pos = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
const CORE_POS: Pos[] = ["QB", "RB", "WR", "TE", "K", "DEF"];

// Map scoring type to the keys used by various sources
function scoringKeys(scoring: ScoringType) {
  return {
    // Sleeper stats suffix used in combined aggregates: pts_<suffix>, adp_<suffix>
    sleeperSuffix: scoring === "ppr" ? "ppr" : scoring === "half" ? "half_ppr" : "std",
    // FantasyPros stats/rankings key group in combined aggregates
    fpKey: scoring === "ppr" ? "ppr" : scoring === "half" ? "half" : "standard",
    // Boris Chen keys in combined aggregates are "std" | "ppr" | "half"
    borisKey: scoring,
  } as const;
}

function toNum(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(/[,%]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

// Extractors from the combined aggregate entry
function getBoris(entry: any, scoring: ScoringType): { rank: number | null; tier: number | null } {
  const { borisKey } = scoringKeys(scoring);
  // Primary: use matching key for scoring type; Fallback: std (e.g., QB/K/DEF only have std)
  const bcPrimary = entry?.borischen?.[borisKey] ?? null;
  const bcFallback = entry?.borischen?.std ?? null;
  const bc = bcPrimary ?? bcFallback ?? null;
  const rank = bc && typeof bc.rank !== "undefined" ? toNum(bc.rank) : null;
  const tier = bc && typeof bc.tier !== "undefined" ? toNum(bc.tier) : null;
  return { rank, tier };
}

function getSleeperPtsAdp(entry: any, scoring: ScoringType): { pts: number | null; adp: number | null } {
  const { sleeperSuffix } = scoringKeys(scoring);
  const stats = (entry?.sleeper?.stats ?? {}) as Record<string, unknown>;
  const pts = toNum(stats[`pts_${sleeperSuffix}`]);
  const adp = toNum(stats[`adp_${sleeperSuffix}`]);
  return { pts, adp };
}

function getFpPts(entry: any, scoring: ScoringType): number | null {
  const { fpKey } = scoringKeys(scoring);
  const grp = entry?.fantasypros?.stats?.[fpKey] ?? null;
  if (!grp) return null;
  return toNum(grp?.["FPTS_AVG"]);
}

function getFpRanks(entry: any, scoring: ScoringType): {
  ecrOverall: number | null;
  tier: number | null;
  posRank: number | null;
} {
  const { fpKey } = scoringKeys(scoring);
  const r = entry?.fantasypros?.rankings?.[fpKey] ?? null;
  const posRankStr: string | undefined = entry?.fantasypros?.pos_rank;
  const posRankNum = posRankStr ? Number(posRankStr.match(/^[A-Z]+(\d+)$/)?.[1] ?? "") : NaN;
  return {
    ecrOverall: toNum(r?.rank_ecr),
    tier: toNum(r?.tier),
    posRank: Number.isFinite(posRankNum) ? posRankNum : null,
  };
}

function getFpAdp(_entry: any, _scoring: ScoringType): number | null {
  // Placeholder until FantasyPros ADP is wired
  return null;
}

// Group players by position and sort by FP points (desc)
function groupByPosFpPts(players: any[], scoring: ScoringType): Record<Pos, { p: any; pts: number }[]> {
  const by: Record<Pos, { p: any; pts: number }[]> = { QB: [], RB: [], WR: [], TE: [], K: [], DEF: [] } as const as any;
  for (const p of players) {
    const raw = String(p?.position ?? "").toUpperCase();
    const pos = (raw === "DST" ? "DEF" : raw) as Pos;
    if (!CORE_POS.includes(pos)) continue;
    const pts = getFpPts(p, scoring);
    if (pts == null) continue;
    by[pos].push({ p, pts });
  }
  for (const pos of CORE_POS) by[pos].sort((a, b) => b.pts - a.pts);
  return by;
}

// Greedy allocation of FLEX across RB/WR/TE using the next-best FP points
function greedyFlexTake(by: Record<Pos, { p: any; pts: number }[]>, flexSlots: number): Record<"RB" | "WR" | "TE", number> {
  const take: Record<"RB" | "WR" | "TE", number> = { RB: 0, WR: 0, TE: 0 };
  const idx: Record<"RB" | "WR" | "TE", number> = { RB: 0, WR: 0, TE: 0 };
  for (let k = 0; k < Math.max(0, flexSlots); k++) {
    let best: "RB" | "WR" | "TE" | null = null;
    let bestPts = -Infinity;
    for (const pos of ["RB", "WR", "TE"] as const) {
      const i = idx[pos];
      const pts = i < by[pos].length ? by[pos][i].pts : -Infinity;
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

function computeFpBaselines(players: any[], league: League, scoring: ScoringType): Record<Pos, number> {
  const by = groupByPosFpPts(players, scoring);
  const flexTake = greedyFlexTake(by, (league.teams || 0) * (league.roster?.FLEX || 0));
  const starters: Record<Pos, number> = {
    QB: (league.teams || 0) * (league.roster?.QB || 0),
    RB: (league.teams || 0) * (league.roster?.RB || 0) + flexTake.RB,
    WR: (league.teams || 0) * (league.roster?.WR || 0) + flexTake.WR,
    TE: (league.teams || 0) * (league.roster?.TE || 0) + flexTake.TE,
    K: (league.teams || 0) * ((league.roster as any)?.K || 1),
    DEF: (league.teams || 0) * (((league.roster as any)?.DEF || (league.roster as any)?.DST || 1) as number),
  } as const;
  const base: Record<Pos, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const pos of CORE_POS) {
    const n = starters[pos];
    const lst = by[pos];
    if (!lst.length || n <= 0) {
      base[pos] = 0;
      continue;
    }
    const i = Math.min(Math.max(0, n - 1), lst.length - 1); // clamp
    base[pos] = lst[i].pts;
  }
  return base;
}

// Per-player local scarcity: forward gap to the next best in-position (fallback to backward gap at tail)
function computeFpLocalScarcity(players: any[], scoring: ScoringType): Map<any, number> {
  const by = groupByPosFpPts(players, scoring);
  const out = new Map<any, number>();
  for (const pos of CORE_POS) {
    const lst = by[pos];
    for (let i = 0; i < lst.length; i++) {
      const cur = lst[i].pts;
      const next = i + 1 < lst.length ? lst[i + 1].pts : null;
      const prev = i - 1 >= 0 ? lst[i - 1].pts : null;
      let gap = 0;
      if (next != null) gap = cur - next; // forward gap
      else if (prev != null) gap = prev - cur; // tail fallback
      if (gap < 0) gap = 0;
      out.set(lst[i].p, gap);
    }
  }
  return out;
}

// Replacement slope (per-position): gap at the replacement boundary
function computeFpReplacementSlope(
  players: any[],
  league: League,
  scoring: ScoringType
): Record<Pos, number> {
  const by = groupByPosFpPts(players, scoring);
  const flexTake = greedyFlexTake(by, (league.teams || 0) * (league.roster?.FLEX || 0));
  const starters: Record<Pos, number> = {
    QB: (league.teams || 0) * (league.roster?.QB || 0),
    RB: (league.teams || 0) * (league.roster?.RB || 0) + flexTake.RB,
    WR: (league.teams || 0) * (league.roster?.WR || 0) + flexTake.WR,
    TE: (league.teams || 0) * (league.roster?.TE || 0) + flexTake.TE,
    K: (league.teams || 0) * ((league.roster as any)?.K || 1),
    DEF: (league.teams || 0) * (((league.roster as any)?.DEF || (league.roster as any)?.DST || 1) as number),
  } as const;
  const slope: Record<Pos, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const pos of CORE_POS) {
    const lst = by[pos].map((x) => x.pts);
    const r = starters[pos];
    if (!lst.length || r <= 0) {
      slope[pos] = 0;
      continue;
    }
    const i = Math.min(Math.max(0, r - 1), lst.length - 1);
    if (i + 1 < lst.length) slope[pos] = lst[i] - lst[i + 1];
    else if (i - 1 >= 0) slope[pos] = lst[i - 1] - lst[i];
    else slope[pos] = 0;
  }
  return slope;
}

// Percentage of positive value remaining after a given player is taken.
// Uses positive value = max(0, pts - baseline) up to the starter threshold.
function computeRemainingPositiveValuePercent(
  players: any[],
  league: League,
  scoring: ScoringType
): Map<string, number> {
  const by = groupByPosFpPts(players, scoring);
  const flexTake = greedyFlexTake(by, (league.teams || 0) * (league.roster?.FLEX || 0));
  const starters: Record<Pos, number> = {
    QB: (league.teams || 0) * (league.roster?.QB || 0),
    RB: (league.teams || 0) * (league.roster?.RB || 0) + flexTake.RB,
    WR: (league.teams || 0) * (league.roster?.WR || 0) + flexTake.WR,
    TE: (league.teams || 0) * (league.roster?.TE || 0) + flexTake.TE,
    K: (league.teams || 0) * ((league.roster as any)?.K || 1),
    DEF: (league.teams || 0) * (((league.roster as any)?.DEF || (league.roster as any)?.DST || 1) as number),
  } as const;

  const out = new Map<string, number>();
  for (const pos of CORE_POS) {
    const list = by[pos]; // sorted desc by pts
    if (!list.length) continue;

    const r = Math.max(0, starters[pos] - 1);
    const baseline = list[Math.min(r, list.length - 1)]?.pts ?? 0;
    const starterEnd = Math.min(starters[pos], list.length);
    const values = list.slice(0, starterEnd).map((x) => Math.max(0, x.pts - baseline));
    const totalPool = values.reduce((a, b) => a + b, 0);
    if (totalPool <= 0) {
      for (const { p } of list) out.set(String(p?.player_id ?? ""), 0);
      continue;
    }
    // prefix sum to compute remaining AFTER taking player at index i
    const prefix: number[] = new Array(values.length + 1).fill(0);
    for (let i = 0; i < values.length; i++) prefix[i + 1] = prefix[i] + values[i];

    for (let i = 0; i < list.length; i++) {
      const pid = String(list[i]?.p?.player_id ?? "");
      if (!pid) continue;
      const start = Math.min(i + 1, values.length); // after taking this player
      const remaining = start < values.length ? prefix[values.length] - prefix[start] : 0;
      const pct = Math.round((remaining / totalPool) * 100);
      out.set(pid, pct);
    }
  }
  return out;
}

// Main enrichment: returns a new array with flat computed fields added
export function enrichPlayers(players: any[], league: League): any[] {
  const scoring = league.scoring;
  const baselines = computeFpBaselines(players, league, scoring);
  const replacementSlope = computeFpReplacementSlope(players, league, scoring);
  const localScarcity = computeFpLocalScarcity(players, scoring);
  const remainingPct = computeRemainingPositiveValuePercent(players, league, scoring);

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
    for (let i = 0; i < sleeperAdps.length; i++) if (adp <= sleeperAdps[i]) return i + 1; // 1-based
    return sleeperAdps.length;
  }
  function overallRankFromPts(pts: number | null): number | null {
    if (pts == null || sleeperPtsAll.length === 0) return null;
    for (let i = 0; i < sleeperPtsAll.length; i++) if (pts >= sleeperPtsAll[i]) return i + 1; // 1-based
    return sleeperPtsAll.length;
  }

  return players.map((p) => {
    const rawPos = String(p?.position ?? "").toUpperCase();
    const pos = (rawPos === "DST" ? "DEF" : rawPos) as Pos;

    // Boris Chen
    const { rank: bc_rank, tier: bc_tier } = getBoris(p, scoring);

    // Sleeper
    const { pts: sleeper_pts, adp: sleeper_adp } = getSleeperPtsAdp(p, scoring);
    const sleeper_rank_overall = overallRankFromAdp(sleeper_adp) ?? overallRankFromPts(sleeper_pts);

    // FantasyPros
    const fp_pts = getFpPts(p, scoring);
    const fp_adp = getFpAdp(p, scoring);
    const { ecrOverall: fp_rank_overall, tier: fp_tier, posRank: fp_rank_pos } = getFpRanks(p, scoring);
    const fp_baseline_pts = baselines[pos] ?? 0;
    // Allow negative values below baseline; round to whole number
    const fp_value = fp_pts == null ? null : Math.round(fp_pts - fp_baseline_pts);
    const local = localScarcity.get(p) ?? 0;
    const repl = replacementSlope[pos] ?? 0;
    const index = repl > 0 ? local / repl : 0; // dimensionless index
    // UI scarcity = percent of positive value remaining after this player is taken
    const fp_positional_scarcity_slope = remainingPct.get(String(p?.player_id ?? "")) ?? 0;
    const fp_player_owned_avg = toNum(p?.fantasypros?.player_owned_avg);
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
    };
  });
}

export default enrichPlayers;
