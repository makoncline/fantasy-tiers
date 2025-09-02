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

  // Load FantasyPros aggregate and index by normalized name
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

    // FantasyPros match by normalized name
    const fp = fpByNormName.get(normalizedName);
    const team =
      (fp?.player_team_id as string | undefined) ?? p.player.team ?? null;
    // Coerce bye_week to number or null (handle string values from data)
    const bye_week =
      fp?.player_bye_week != null ? Number(fp.player_bye_week) || null : null;

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

    const fantasypros =
      fp && fp.player_id
        ? {
            player_id: String(fp.player_id),
            player_owned_avg: fp.player_owned_avg ?? null,
            pos_rank: fp.pos_rank ?? null,
            stats: fp.stats ?? {},
            rankings: fp.rankings ?? {},
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
