#!/usr/bin/env -S node --experimental-strip-types --enable-source-maps

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePlayerName, normalizePosition } from "../../src/lib/util";
import {
  POSITIONS_TO_SCORING_TYPES,
  FANTASY_POSITIONS,
} from "../../src/lib/scoring";
import { CombinedEntry, CombinedShard } from "../../src/lib/schemas-aggregates";
import { parse as parseCsvSync } from "csv-parse/sync";
import { globSync } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson<T = any>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

const POS_NO_VARIANT = new Set(["QB", "K", "DEF"]);

function mirror<T>(
  pos: string,
  b: { std: T | null; ppr: T | null; half: T | null }
): { std: T | null; ppr: T | null; half: T | null } {
  if (!POS_NO_VARIANT.has(pos)) return b;
  const base = b.std ?? b.ppr ?? b.half ?? null;
  return { std: base, ppr: base, half: base };
}

function loadLatestWeeklyEcrMap(
  scoring: "std" | "half" | "ppr",
  fpPos: "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DST",
  root: string
): Map<string, any> {
  const dir = path.join(root, "public", "data", "fantasypros", "raw");
  const pattern = `ECR-weekly-${scoring}-${fpPos.toLowerCase()}-week-*_raw.json`;
  const files = globSync(pattern, { cwd: dir, absolute: true, nodir: true });
  let latest: string | null = null;
  let bestWeek = -1;
  for (const f of files) {
    const m = f.match(/week-(\d+)_raw\.json$/);
    const wk = m ? Number(m[1]) : NaN;
    if (Number.isFinite(wk) && wk > bestWeek) {
      bestWeek = wk;
      latest = f;
    }
  }
  const map = new Map<string, any>();
  if (!latest) return map;
  try {
    const txt = fs.readFileSync(latest, "utf8");
    const json = JSON.parse(txt) as { raw?: any; rows?: any[] };
    const arr = Array.isArray(json?.rows)
      ? json.rows
      : Array.isArray((json as any)?.raw?.players)
      ? (json as any).raw.players
      : [];
    for (const row of arr) {
      const nm = normalizePlayerName(String(row.player_name || ""));
      if (!nm) continue;
      // Prefer non-FLEX rows and those with start_sit_grade when we encounter duplicates; here per pos we assume homogenous
      if (!map.has(nm)) map.set(nm, row);
    }
  } catch {}
  return map;
}

async function main() {
  const root = path.resolve(__dirname, "../../");
  const sleeperProjectionsPath = path.join(
    root,
    "public",
    "data",
    "sleeper",
    "projections-latest.json"
  );
  const fpAggPath = path.join(
    root,
    "public",
    "data",
    "fantasypros",
    "fantasypros_aggregate.json"
  );
  const rankingsDir = path.join(root, "public", "data");
  const borisDir = path.join(rankingsDir, "borischen");
  const outDir = path.join(root, "public", "data", "aggregate");
  const outFile = path.join(outDir, "combined-aggregate.json");
  const metaOutFile = path.join(outDir, "metadata.json");

  // Validate inputs exist with helpful guidance
  if (!fs.existsSync(sleeperProjectionsPath)) {
    throw new Error(
      `Missing Sleeper projections: ${sleeperProjectionsPath}\n` +
        `Run: pnpm run fetch:sleeper`
    );
  }
  if (!fs.existsSync(fpAggPath)) {
    throw new Error(
      `Missing FantasyPros aggregate: ${fpAggPath}\n` +
        `Build it with: pnpm run agg:fp (and fetch first with: pnpm run fetch:fp)`
    );
  }

  // Load Sleeper projections (season aggregate preferred)
  const projRaw = readJson(sleeperProjectionsPath);
  const projections: any[] = Array.isArray(projRaw) ? projRaw : [];

  // Load FantasyPros aggregate and index by normalized name (used for team/bye and fallback)
  const fpRaw = readJson(fpAggPath);
  const fpRows: any[] = Array.isArray(fpRaw)
    ? fpRaw
    : Array.isArray(fpRaw?.data)
    ? fpRaw.data
    : [];
  const fpByNormName = new Map<string, any>();
  for (const row of fpRows) {
    const name = (row?.player_name ?? "").toString();
    if (!name) continue;
    const norm = normalizePlayerName(name);
    if (!fpByNormName.has(norm)) fpByNormName.set(norm, row);
  }

  // Preload weekly ECR per position and scoring
  const FP_POSITIONS: Array<"QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DST"> =
    ["QB", "RB", "WR", "TE", "FLEX", "K", "DST"];
  const fpWeeklyByPosScore: Record<
    string,
    { std: Map<string, any>; half: Map<string, any>; ppr: Map<string, any> }
  > = {};
  for (const pos of FP_POSITIONS) {
    fpWeeklyByPosScore[pos] = {
      std: loadLatestWeeklyEcrMap("std", pos, root),
      half: loadLatestWeeklyEcrMap("half", pos, root),
      ppr: loadLatestWeeklyEcrMap("ppr", pos, root),
    };
  }

  // Load Boris Chen from raw CSVs → { [position]: { [scoring]: Map<normalizedName, {rank,tier}> } }
  const borisByPosScore: Record<
    string,
    Record<string, Map<string, { rank: number; tier: number }>>
  > = {};
  // Additionally load ALL overall Boris Chen rankings per scoring
  const borisAllByScore: Record<
    "std" | "ppr" | "half",
    Map<string, { rank: number; tier: number }>
  > = {
    std: new Map(),
    ppr: new Map(),
    half: new Map(),
  };
  let borisAnyFound = false;
  for (const [position, scoringTypes] of Object.entries(
    POSITIONS_TO_SCORING_TYPES
  )) {
    borisByPosScore[position] = {};
    for (const scoring of scoringTypes) {
      const file = path.join(
        borisDir,
        `${position}-${scoring}-rankings-raw.csv`
      );
      const map = new Map<string, { rank: number; tier: number }>();
      if (fs.existsSync(file)) {
        try {
          const csv = fs.readFileSync(file, "utf8");
          const rows: any[] = parseCsvSync(csv, {
            columns: true,
            skip_empty_lines: true,
          });
          borisAnyFound = borisAnyFound || rows.length > 0;
          for (const row of rows) {
            const name = String(row?.["Player.Name"] || "").trim();
            const nm = name ? normalizePlayerName(name) : "";
            if (!nm) continue;
            const rank = Number(row?.["Rank"]);
            const tier = Number(row?.["Tier"]);
            if (Number.isFinite(rank) && Number.isFinite(tier)) {
              map.set(nm, { rank, tier });
            }
          }
        } catch {
          // ignore
        }
      }
      borisByPosScore[position][scoring] = map;
    }
  }
  if (!borisAnyFound) {
    // eslint-disable-next-line no-console
    console.warn(
      `No Boris Chen raw rankings found under ${borisDir}.\n` +
        `Fetch them with: pnpm run fetch:borischen`
    );
  }
  // Load ALL (overall) Boris Chen CSVs to be used for the ALL shard
  for (const scoring of ["std", "ppr", "half"] as const) {
    const file = path.join(borisDir, `ALL-${scoring}-rankings-raw.csv`);
    const map = borisAllByScore[scoring];
    if (fs.existsSync(file)) {
      try {
        const csv = fs.readFileSync(file, "utf8");
        const rows: any[] = parseCsvSync(csv, {
          columns: true,
          skip_empty_lines: true,
        });
        for (const row of rows) {
          const name = String(row?.["Player.Name"] || "").trim();
          const nm = name ? normalizePlayerName(name) : "";
          if (!nm) continue;
          const rank = Number(row?.["Rank"]);
          const tier = Number(row?.["Tier"]);
          if (Number.isFinite(rank) && Number.isFinite(tier)) {
            map.set(nm, { rank, tier });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Build combined entries keyed by Sleeper player_id
  const combined: Record<string, any> = {};
  const seen = new Set<string>();
  for (const p of projections) {
    const pid = String(p.player_id || "");
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);

    const first = p.player.first_name ?? "";
    const last = p.player.last_name ?? "";
    const rawName = `${first} ${last}`.trim();
    const normalizedName = normalizePlayerName(rawName);
    const pos = normalizePosition(String(p.player.position || ""));

    // Skip invalid positions (FB, CB, DT, P, etc.) or non-fantasy positions
    if (!pos || !FANTASY_POSITIONS.has(pos)) continue;

    const fpAggRow = fpByNormName.get(normalizedName);
    const team =
      (fpAggRow?.player_team_id as string | undefined) ?? p.player.team ?? null;
    const bye_week =
      fpAggRow?.player_bye_week != null
        ? Number(fpAggRow.player_bye_week) || null
        : null;

    // Boris Chen rankings for this player's position
    // Pull per-scoring rankings where available, and only mirror for QB/K/DEF
    const getBoris = (scoring: "std" | "ppr" | "half") =>
      borisByPosScore[pos]?.[scoring]?.get(normalizedName) ?? null;
    const borischen = mirror(pos, {
      std: getBoris("std"),
      ppr: getBoris("ppr"),
      half: getBoris("half"),
    });

    // Sleeper subset for example-compatible format (whitelist specific stats)
    const allowedStatKeys = new Set([
      "adp_std",
      "adp_half_ppr",
      "adp_ppr",
      "pts_std",
      "pts_half_ppr",
      "pts_ppr",
    ]);
    const filteredStats: Record<string, number> = {};
    if (p.stats && typeof p.stats === "object") {
      for (const [k, v] of Object.entries(p.stats)) {
        if (!allowedStatKeys.has(k)) continue;
        const n = typeof v === "string" ? Number(v) : (v as number);
        if (typeof n === "number" && Number.isFinite(n)) filteredStats[k] = n;
      }
    }
    const sleeper = {
      stats: filteredStats,
      week: p.week ?? null,
      player: {
        injury_body_part: p.player.injury_body_part ?? null,
        injury_notes: p.player.injury_notes ?? null,
        injury_start_date: p.player.injury_start_date ?? null,
        injury_status: p.player.injury_status ?? null,
      },
      updated_at: p.updated_at ?? null,
    };

    // Position-specific FantasyPros ECR
    const fpPos = pos === "DEF" ? "DST" : (pos as any as "RB");
    const maps = fpWeeklyByPosScore[fpPos] || {
      std: new Map(),
      half: new Map(),
      ppr: new Map(),
    };
    const stdRow = maps.std.get(normalizedName);
    const halfRow = maps.half.get(normalizedName);
    const pprRow = maps.ppr.get(normalizedName);
    const bestRow = pprRow || halfRow || stdRow || fpAggRow || null;

    const rankShape = (row?: any) =>
      row
        ? {
            rank_ecr: Number(row.rank_ecr ?? null),
            rank_min: row.rank_min != null ? Number(row.rank_min) : null,
            rank_max: row.rank_max != null ? Number(row.rank_max) : null,
            rank_ave: row.rank_ave != null ? Number(row.rank_ave) : null,
            rank_std: row.rank_std != null ? Number(row.rank_std) : null,
            tier: row.tier ?? null,
          }
        : undefined;

    const fantasypros = bestRow
      ? {
          player_id: String(bestRow.player_id ?? fpAggRow?.player_id ?? ""),
          player_owned_avg:
            bestRow.player_owned_avg ?? fpAggRow?.player_owned_avg ?? null,
          pos_rank: bestRow.pos_rank ?? fpAggRow?.pos_rank ?? null,
          start_sit_grade:
            bestRow.start_sit_grade ?? fpAggRow?.start_sit_grade ?? null,
          stats: {
            standard: {},
            ppr: {},
            half: {},
          },
          rankings: {
            ...(stdRow ? { standard: rankShape(stdRow)! } : {}),
            ...(halfRow ? { half: rankShape(halfRow)! } : {}),
            ...(pprRow ? { ppr: rankShape(pprRow)! } : {}),
          },
        }
      : null;

    const entry = {
      player_id: pid,
      name: normalizedName,
      position: pos,
      team,
      bye_week,
      borischen,
      sleeper,
      fantasypros,
    };

    // Validate entry before adding to combined
    try {
      CombinedEntry.parse(entry);
      combined[pid] = entry;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        `Skipping invalid entry for ${normalizedName} (${pid}):`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  ensureDir(outDir);
  // Do not write combined-aggregate.json anymore; keep per-position only
  try {
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  } catch {}
  // Write per-position shards
  const positions: string[] = [
    "DEF",
    "K",
    "QB",
    "RB",
    "TE",
    "WR",
    "FLEX",
    "ALL",
  ];
  for (const pos of positions) {
    const shard: Record<string, any> = {};
    for (const [pid, entry] of Object.entries(combined)) {
      if (pos === "ALL") {
        // For ALL shard, use the overall (ALL) Boris Chen rankings per scoring
        const nm = entry.name as string;
        const bAll = {
          std: borisAllByScore.std.get(nm) ?? null,
          ppr: borisAllByScore.ppr.get(nm) ?? null,
          half: borisAllByScore.half.get(nm) ?? null,
        };
        shard[pid] = { ...entry, borischen: bAll };
      } else if (pos === "FLEX") {
        if (["RB", "WR", "TE"].includes(entry.position)) {
          // For FLEX, use FLEX-specific Boris Chen rankings instead of individual position rankings
          const nm = entry.name as string;
          const bFlex = {
            std: borisByPosScore["FLEX"]?.std?.get(nm) ?? null,
            ppr: borisByPosScore["FLEX"]?.ppr?.get(nm) ?? null,
            half: borisByPosScore["FLEX"]?.half?.get(nm) ?? null,
          };
          shard[pid] = { ...entry, borischen: bFlex };
        }
      } else {
        if (entry.position === pos) shard[pid] = entry;
      }
    }
    const shardPath = path.join(outDir, `${pos}-combined-aggregate.json`);

    // Validate shard before writing
    try {
      CombinedShard.parse(shard);
      fs.writeFileSync(shardPath, JSON.stringify(shard, null, 2));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `Failed to validate ${pos} shard:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }
  // Build aggregates metadata
  try {
    const fpRawDir = path.join(root, "public", "data", "fantasypros", "raw");
    const scorings = ["STD", "HALF", "PPR"] as const;
    type ScoringType = (typeof scorings)[number];
    const positionsForScoring: Record<ScoringType, string[]> = {
      STD: ["QB", "RB", "WR", "TE", "FLEX", "K", "DST"],
      HALF: ["RB", "WR", "TE", "FLEX"],
      PPR: ["RB", "WR", "TE", "FLEX"],
    };
    const fpMeta: Record<string, Record<string, any>> = {};
    for (const scoring of scorings) {
      const scoringKey = scoring;
      fpMeta[scoringKey] = {};
      const positions = positionsForScoring[scoring];
      for (const pos of positions) {
        const pattern = `ECR-weekly-${scoring.toLowerCase()}-${pos.toLowerCase()}-week-*_raw.json`;
        const files = globSync(pattern, {
          cwd: fpRawDir,
          absolute: true,
          nodir: true,
        });
        if (!files.length) continue;
        // choose latest by week number
        let best: { file: string; week: number } | null = null;
        for (const f of files) {
          const m = f.match(/week-(\d+)_raw\.json$/);
          const wk = m ? Number(m[1]) : NaN;
          if (Number.isFinite(wk) && (best === null || wk > best.week))
            best = { file: f, week: wk };
        }
        const file = best?.file || files[0];
        if (!file) continue; // Skip if no file found
        try {
          const txt = fs.readFileSync(file, "utf8");
          const json = JSON.parse(txt) as { raw?: any };
          const r = json?.raw ?? {};
          // Try to read sidecar metadata file for last_scraped and url
          let last_scraped: string | null = null;
          let url: string | null = null;
          try {
            const metaPath = file.replace(/_raw\.json$/, "-metadata.json");
            if (fs.existsSync(metaPath)) {
              const metaTxt = fs.readFileSync(metaPath, "utf8");
              const metaJson = JSON.parse(metaTxt) as {
                accessed?: string;
                url?: string;
              };
              last_scraped = (metaJson?.accessed as string | undefined) ?? null;
              url = (metaJson?.url as string | undefined) ?? null;
            }
          } catch {}
          fpMeta[scoringKey][pos] = {
            last_updated: r.last_updated ?? null,
            total_experts: r.total_experts ?? null,
            scoring: r.scoring ?? scoring,
            position_id: r.position_id ?? pos,
            week: r.week ?? best?.week ?? null,
            year: r.year ?? null,
            last_scraped,
            url,
          };
        } catch {
          // ignore invalid file
        }
      }
    }
    const aggregatesMetadata = { fp: fpMeta } as const;
    fs.writeFileSync(metaOutFile, JSON.stringify(aggregatesMetadata, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      "Failed to build aggregates metadata:",
      e instanceof Error ? e.message : String(e)
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    `Wrote per-position combined aggregates to ${path.relative(
      root,
      outDir
    )} (${Object.keys(combined).length} players total).`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
