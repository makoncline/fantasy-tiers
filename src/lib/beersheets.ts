import type { SleeperProjection } from "./sleeper";

export type LeagueShape = {
  teams: number;
  slots_qb: number;
  slots_rb: number;
  slots_wr: number;
  slots_te: number;
  slots_k: number;
  slots_def: number;
  slots_flex: number; // classic RB/WR/TE
};

type ScoringType = "ppr" | "half" | "std";

export type BeerRow = {
  player_id: string;
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
  proj_pts: number;
};

const scoringKeyOf = (scoring: ScoringType) =>
  scoring === "ppr"
    ? "pts_ppr"
    : scoring === "half"
    ? "pts_half_ppr"
    : "pts_std";

// K/DST excluded from BeerSheets computation per product decision
const STREAMING_PENALTY: Record<string, number> = { K: 0, DEF: 0 };

function toRoundPick(
  adp: number | undefined,
  teams: number | undefined
): string | undefined {
  if (!adp || !Number.isFinite(adp) || !teams || teams <= 0) return undefined;
  const pick = Math.round(adp);
  const round = Math.floor((pick - 1) / teams) + 1;
  const slot = ((pick - 1) % teams) + 1;
  return `${round}.${slot}`;
}

export function computeBeerSheetsBoard(
  projections: SleeperProjection[],
  playersMeta: Record<string, any>,
  shape: LeagueShape,
  scoring: ScoringType,
  opts?: { baselineWindow?: number; superflex?: boolean }
): BeerRow[] {
  const window = opts?.baselineWindow ?? 3;
  const key = scoringKeyOf(scoring);

  // 1) normalize rows
  const rows: BeerRow[] = (projections || [])
    .filter(
      (p) =>
        p?.player?.position &&
        p.stats &&
        Number.isFinite((p.stats as any)[key] as number)
    )
    .map((p) => {
      const meta = playersMeta?.[p.player_id] ?? {};
      const team = p.player?.team ?? (p as any).team ?? meta.team ?? undefined;
      const proj = Number((p.stats as any)[key] ?? 0);
      const position = (p.player?.position as BeerRow["position"]) ?? "WR";
      if (position === "K" || position === "DEF") return undefined;
      return {
        player_id: String(p.player_id),
        name:
          [p.player?.first_name, p.player?.last_name]
            .filter(Boolean)
            .join(" ") || "",
        position,
        proj_pts: proj,
      };
    })
    .filter(Boolean) as BeerRow[];

  // 2) group/sort by position
  const byPos: Record<string, BeerRow[]> = {};
  for (const r of rows) {
    (byPos[r.position] ||= []).push(r);
  }
  for (const pos of Object.keys(byPos)) {
    byPos[pos].sort((a, b) => b.proj_pts - a.proj_pts);
  }

  // 3) replacement indices with GREEDY FLEX (RB/WR/TE only unless superflex)
  const repIdx: Record<string, number> = {
    QB: (shape.teams || 0) * (shape.slots_qb || 0),
    RB: (shape.teams || 0) * (shape.slots_rb || 0),
    WR: (shape.teams || 0) * (shape.slots_wr || 0),
    TE: (shape.teams || 0) * (shape.slots_te || 0),
  };
  const totalFlex = (shape.teams || 0) * (shape.slots_flex || 0);
  const flexPool: Array<"QB" | "RB" | "WR" | "TE"> = opts?.superflex
    ? ["QB", "RB", "WR", "TE"]
    : ["RB", "WR", "TE"];
  for (let i = 0; i < totalFlex; i++) {
    let bestPos: (typeof flexPool)[number] | null = null;
    let bestNext = -Infinity;
    for (const pos of flexPool) {
      const idx = repIdx[pos] ?? 0;
      const cand = byPos[pos]?.[idx]?.proj_pts ?? -Infinity;
      if (cand > bestNext) {
        bestNext = cand;
        bestPos = pos;
      }
    }
    if (bestPos) repIdx[bestPos] = (repIdx[bestPos] ?? 0) + 1;
  }
  for (const pos of Object.keys(repIdx)) {
    if (!Number.isFinite(repIdx[pos])) repIdx[pos] = 0;
  }

  // 4) baselines (windowed mean at/after rep index) + streaming penalty
  const baselines: Record<string, number> = {};
  const meanFrom = (arr: BeerRow[] | undefined, start: number, w: number) => {
    const a = arr || [];
    if (!a.length) return 0;
    const i = Math.max(0, Math.min(start, a.length - 1));
    const slice = a.slice(i, Math.min(a.length, i + w));
    const sum = slice.reduce((s, r) => s + r.proj_pts, 0);
    return slice.length ? sum / slice.length : 0;
  };
  for (const pos of Object.keys(repIdx)) {
    const base = meanFrom(byPos[pos], repIdx[pos], window);
    const bump = STREAMING_PENALTY[pos] ?? 0;
    baselines[pos] = base + bump;
  }

  // instrumentation: emit baseline snapshot for sanity checks in dev
  if (typeof console !== "undefined") {
    try {
      debugBaselines(byPos, repIdx, baselines);
      // concise baseline/repIdx snapshot
      // eslint-disable-next-line no-console
      console.log("Baselines/repIdx", {
        QB: { rep: repIdx.QB, base: baselines.QB?.toFixed(1) },
        RB: { rep: repIdx.RB, base: baselines.RB?.toFixed(1) },
        WR: { rep: repIdx.WR, base: baselines.WR?.toFixed(1) },
        TE: { rep: repIdx.TE, base: baselines.TE?.toFixed(1) },
      });
    } catch {}
  }

  // 5) overall ranks (by projected points)
  const all = Object.values(byPos).flat();
  all.sort((a, b) => b.proj_pts - a.proj_pts);
  return all;
}

export function debugBaselines(
  byPos: Record<string, BeerRow[]>,
  repIdx: Record<string, number>,
  baselines: Record<string, number>
) {
  const snap = Object.fromEntries(
    Object.keys(repIdx).map((p) => [
      p,
      {
        repIdx: repIdx[p],
        basePts: Number((baselines[p] ?? 0).toFixed(1)),
        sampleTop: (byPos[p] || []).slice(0, 1).map((r) => ({
          id: r.player_id,
          pts: r.proj_pts,
        })),
      },
    ])
  );
  // eslint-disable-next-line no-console
  console.log("BeerSheets baselines:", snap);
}
