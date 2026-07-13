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
import {
  fantasyProsExpertMetadata,
  normalizeExpertSampleMetadata,
  type ExpertSampleMetadata,
} from "../fp/fantasyprosExpertMetadata";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson<T = any>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

type FantasyProsFetchMode = {
  mode?: string;
  projectionsFetched?: boolean;
  fetchedAt?: string;
};

function readFantasyProsFetchMode(root: string): FantasyProsFetchMode | null {
  const markerPath = path.join(
    root,
    "public",
    "data",
    "fantasypros",
    "raw",
    "fetch-mode.json"
  );
  try {
    if (!fs.existsSync(markerPath)) return null;
    return readJson<FantasyProsFetchMode>(markerPath);
  } catch {
    return null;
  }
}

function emptyFantasyProsScoreMaps(): {
  std: Map<string, any>;
  half: Map<string, any>;
  ppr: Map<string, any>;
} {
  return {
    std: new Map(),
    half: new Map(),
    ppr: new Map(),
  };
}

function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date =
    typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function hasExpertSample(experts: ExpertSampleMetadata): boolean {
  return (
    experts.included != null ||
    experts.available != null ||
    experts.included_ids.length > 0 ||
    experts.excluded_ids.length > 0 ||
    experts.filter_ids.length > 0
  );
}

function registerExpertSample(
  samples: Record<string, ExpertSampleMetadata>,
  key: string,
  experts: ExpertSampleMetadata
): string | null {
  if (!hasExpertSample(experts)) return null;
  samples[key] = experts;
  return key;
}

function expertSummary(
  experts: ExpertSampleMetadata,
  sampleKey: string | null
) {
  return {
    included: experts.included,
    available: experts.available,
    coverage_pct: experts.coverage_pct,
    sample_size: experts.sample_size,
    last_updated: experts.last_updated,
    sample_key: sampleKey,
  };
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
  const tiersDir = path.join(rankingsDir, "tiers");
  const outDir = path.join(root, "public", "data", "aggregate");
  const outFile = path.join(outDir, "combined-aggregate.json");
  const metaOutFile = path.join(outDir, "metadata.json");
  const fpFetchMode = readFantasyProsFetchMode(root);
  const useFantasyProsWeeklyRaw = fpFetchMode?.mode !== "draft";

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
    fpWeeklyByPosScore[pos] = useFantasyProsWeeklyRaw
      ? {
          std: loadLatestWeeklyEcrMap("std", pos, root),
          half: loadLatestWeeklyEcrMap("half", pos, root),
          ppr: loadLatestWeeklyEcrMap("ppr", pos, root),
        }
      : emptyFantasyProsScoreMaps();
  }

  // Load Tiers from raw CSVs → { [position]: { [scoring]: Map<normalizedName, {rank,tier}> } }
  const tiersByPosScore: Record<
    string,
    Record<string, Map<string, { rank: number; tier: number }>>
  > = {};
  // Additionally load ALL overall Tiers rankings per scoring
  const tiersAllByScore: Record<
    "std" | "ppr" | "half",
    Map<string, { rank: number; tier: number }>
  > = {
    std: new Map(),
    ppr: new Map(),
    half: new Map(),
  };
  let tiersAnyFound = false;
  for (const [position, scoringTypes] of Object.entries(
    POSITIONS_TO_SCORING_TYPES
  )) {
    tiersByPosScore[position] = {};
    for (const scoring of scoringTypes) {
      const file = path.join(
        tiersDir,
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
          tiersAnyFound = tiersAnyFound || rows.length > 0;
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
      tiersByPosScore[position][scoring] = map;
    }
  }
  if (!tiersAnyFound) {
    // eslint-disable-next-line no-console
    console.warn(
      `No Tiers raw rankings found under ${tiersDir}.\n` +
        `Fetch them with: pnpm run fetch:tiers`
    );
  }
  // Load ALL (overall) Tiers CSVs to be used for the ALL shard
  for (const scoring of ["std", "ppr", "half"] as const) {
    const file = path.join(tiersDir, `ALL-${scoring}-rankings-raw.csv`);
    const map = tiersAllByScore[scoring];
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

    // Tiers rankings for this player's position
    // Pull per-scoring rankings where available, and only mirror for QB/K/DEF
    const getTierRanking = (scoring: "std" | "ppr" | "half") =>
      tiersByPosScore[pos]?.[scoring]?.get(normalizedName) ?? null;
    const tiers = mirror(pos, {
      std: getTierRanking("std"),
      ppr: getTierRanking("ppr"),
      half: getTierRanking("half"),
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

    const fpAggRankings = fpAggRow?.rankings ?? {};
    const standardRanking = stdRow
      ? rankShape(stdRow)
      : fpAggRankings.standard;
    const halfRanking = halfRow ? rankShape(halfRow) : fpAggRankings.half;
    const pprRanking = pprRow ? rankShape(pprRow) : fpAggRankings.ppr;
    const fpAggStats = fpAggRow?.stats ?? {};

    const fantasypros = bestRow
      ? {
          player_id: String(bestRow.player_id ?? fpAggRow?.player_id ?? ""),
          player_owned_avg:
            bestRow.player_owned_avg ?? fpAggRow?.player_owned_avg ?? null,
          pos_rank: bestRow.pos_rank ?? fpAggRow?.pos_rank ?? null,
          start_sit_grade:
            bestRow.start_sit_grade ?? fpAggRow?.start_sit_grade ?? null,
          stats: {
            standard: fpAggStats.standard ?? {},
            ppr: fpAggStats.ppr ?? {},
            half: fpAggStats.half ?? {},
          },
          rankings: {
            ...(standardRanking ? { standard: standardRanking } : {}),
            ...(halfRanking ? { half: halfRanking } : {}),
            ...(pprRanking ? { ppr: pprRanking } : {}),
          },
        }
      : null;

    const entry = {
      player_id: pid,
      name: normalizedName,
      position: pos,
      team,
      bye_week,
      tiers,
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
        // For ALL shard, use the overall (ALL) Tiers rankings per scoring
        const nm = entry.name as string;
        const bAll = {
          std: tiersAllByScore.std.get(nm) ?? null,
          ppr: tiersAllByScore.ppr.get(nm) ?? null,
          half: tiersAllByScore.half.get(nm) ?? null,
        };
        shard[pid] = { ...entry, tiers: bAll };
      } else if (pos === "FLEX") {
        if (["RB", "WR", "TE"].includes(entry.position)) {
          // For FLEX, use FLEX-specific Tiers rankings instead of individual position rankings
          const nm = entry.name as string;
          const bFlex = {
            std: tiersByPosScore["FLEX"]?.std?.get(nm) ?? null,
            ppr: tiersByPosScore["FLEX"]?.ppr?.get(nm) ?? null,
            half: tiersByPosScore["FLEX"]?.half?.get(nm) ?? null,
          };
          shard[pid] = { ...entry, tiers: bFlex };
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
    const expertSamples: Record<string, ExpertSampleMetadata> = {};
    const fpMeta: Record<string, Record<string, any>> = {};
    for (const scoring of scorings) {
      const scoringKey = scoring;
      fpMeta[scoringKey] = {};
      const positions = positionsForScoring[scoring];
      for (const pos of positions) {
        const draftFile = path.join(
          fpRawDir,
          `ECR-ADP-${scoring.toLowerCase()}-draft_raw.json`
        );
        const draftMetaFile = path.join(
          fpRawDir,
          `ECR-ADP-${scoring.toLowerCase()}-draft-metadata.json`
        );
        if (fpFetchMode?.mode === "draft" && fs.existsSync(draftFile)) {
          try {
            const txt = fs.readFileSync(draftFile, "utf8");
            const json = JSON.parse(txt) as { raw?: any; rows?: any[] };
            const r = json?.raw ?? {};
            const sidecar = fs.existsSync(draftMetaFile)
              ? readJson<{
                  accessed?: string;
                  last_updated_ts?: number;
                  rowCount?: number;
                  sources?: number;
                  url?: string;
                }>(draftMetaFile)
              : {};
            const experts = fantasyProsExpertMetadata(
              r,
              sidecar.sources ?? null
            );
            const expertSampleKey = registerExpertSample(
              expertSamples,
              `fantasypros:${scoringKey}:draft`,
              experts
            );
            fpMeta[scoringKey][pos] = {
              fetched_at: toIsoDate(sidecar.accessed ?? r.accessed),
              last_updated: toIsoDate(
                Number(r.last_updated_ts ?? sidecar.last_updated_ts) * 1000
              ),
              total_experts: experts.included,
              experts: expertSummary(experts, expertSampleKey),
              scoring: r.scoring ?? scoring,
              position_id: pos,
              week: "draft",
              year: r.year ?? null,
              url: sidecar.url ?? null,
              row_count:
                json.rows?.length ?? sidecar.rowCount ?? r.count ?? null,
              mode: "draft",
              projections_fetched: fpFetchMode.projectionsFetched ?? false,
            };
          } catch {
            // ignore invalid draft metadata
          }
          continue;
        }
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
          let fetched_at: string | null = null;
          let url: string | null = null;
          try {
            const metaPath = file.replace(/_raw\.json$/, "-metadata.json");
            if (fs.existsSync(metaPath)) {
              const metaTxt = fs.readFileSync(metaPath, "utf8");
              const metaJson = JSON.parse(metaTxt) as {
                accessed?: string;
                url?: string;
              };
              fetched_at = (metaJson?.accessed as string | undefined) ?? null;
              url = (metaJson?.url as string | undefined) ?? null;
            }
          } catch {}

          const experts = fantasyProsExpertMetadata(r);
          const expertSampleKey = registerExpertSample(
            expertSamples,
            `fantasypros:${scoringKey}:${pos}:week-${r.week ?? best?.week ?? "unknown"}`,
            experts
          );
          fpMeta[scoringKey][pos] = {
            fetched_at: new Date(fetched_at!).toISOString() ?? null,
            last_updated:
              new Date(r.last_updated_ts * 1000).toISOString() ?? null,
            total_experts: experts.included,
            experts: expertSummary(experts, expertSampleKey),
            scoring: r.scoring ?? scoring,
            position_id: r.position_id ?? pos,
            week: r.week ?? best?.week ?? null,
            year: r.year ?? null,
            url,
          };
        } catch {
          // ignore invalid file
        }
      }
    }

    // Build Tiers metadata
    const tiersRawDir = path.join(root, "public", "data", "tiers");
    const tiersMeta: Record<string, Record<string, any>> = {};

    for (const scoring of scorings) {
      const scoringKey = scoring;
      tiersMeta[scoringKey] = {};
      const positions = positionsForScoring[scoring];

      for (const pos of positions) {
        // Tiers uses DEF for defense, not DST like FantasyPros
        const tiersPos = pos === "DST" ? "DEF" : pos;
        const metadataFile = path.join(
          tiersRawDir,
          `${tiersPos}-${scoring.toLowerCase()}-metadata.json`
        );

        try {
          if (fs.existsSync(metadataFile)) {
            const metaTxt = fs.readFileSync(metadataFile, "utf8");
            const metaJson = JSON.parse(metaTxt) as {
              lastUpdated?: string;
              fetchedAt?: string;
              source?: string;
              sourceUrl?: string;
              totalExperts?: number | null;
              experts?: unknown;
              rowCount?: number | null;
              season?: number | null;
            };
            const experts = normalizeExpertSampleMetadata(
              metaJson.experts ?? {
                included: metaJson.totalExperts ?? null,
              }
            );
            const expertSampleKey = registerExpertSample(
              expertSamples,
              `fantasypros:${scoringKey}:draft`,
              experts
            );
            tiersMeta[scoringKey][pos] = {
              last_updated: toIsoDate(metaJson.lastUpdated),
              fetched_at: toIsoDate(metaJson.fetchedAt),
              total_experts: experts.included,
              experts: expertSummary(experts, expertSampleKey),
              source: metaJson.source ?? null,
              url: metaJson.sourceUrl ?? null,
              row_count: metaJson.rowCount ?? null,
              year: metaJson.season ?? null,
            };
          } else {
            tiersMeta[scoringKey][pos] = {
              last_updated: null,
            };
          }
        } catch {
          tiersMeta[scoringKey][pos] = {
            last_updated: null,
          };
        }
      }
    }

    const aggregatesMetadata = {
      expert_samples: expertSamples,
      fp: fpMeta,
      tiers: tiersMeta,
    };
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
