#!/usr/bin/env -S node --experimental-strip-types --enable-source-maps
/**
 * Name coverage sanity check
 *
 * Purpose:
 * - Sleeper projections are our canonical player name source for the app.
 * - We still combine data from Boris Chen rankings and FantasyPros aggregate.
 * - This script checks the top N Sleeper names for presence in those sources
 *   and surfaces likely mismatches so we can improve normalization.
 *
 * What it does:
 * - Loads the first 300 unique names from Sleeper `projections-latest.json`.
 * - Normalizes names, then checks for presence in:
 *   - Boris Chen processed rankings (`public/data/*-rankings.json`) [deprecated; we read raw CSVs now].
 *   - FantasyPros aggregate (`public/data/fantasypros/fantasypros_aggregate.json`).
 * - Prints any missing names with `adp_std` (fallback to PPR/HALF) to prioritize fixes.
 * - Provides fuzzy suggestions to help identify close matches for normalization.
 *
 * Notes:
 * - Some misses are expected (e.g., DST team rows, non-NFL/inactive players).
 * - Extend `normalizePlayerName` in `src/lib/util.ts` as needed based on output.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePlayerName } from "../../src/lib/util";
import Fuse from "fuse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_COUNT = 300;

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
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
  const rankingsDir = path.join(root, "public", "data");
  const borisDir = path.join(rankingsDir, "borischen");
  const fantasyProsAggPath = path.join(
    rankingsDir,
    "fantasypros",
    "fantasypros_aggregate.json"
  );

  ensureExists(sleeperProjectionsPath);
  ensureExists(fantasyProsAggPath);

  const projections: any[] = Array.isArray(readJson(sleeperProjectionsPath))
    ? readJson(sleeperProjectionsPath)
    : [];

  const seen = new Set<string>();
  const topNames: { raw: string; normalized: string }[] = [];
  for (const row of projections) {
    const first = row?.player?.first_name ?? "";
    const last = row?.player?.last_name ?? "";
    const raw = `${first} ${last}`.trim();
    if (!raw) continue;
    const normalized = normalizePlayerName(raw);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    topNames.push({ raw, normalized });
    if (topNames.length >= SAMPLE_COUNT) break;
  }

  // Collect Boris Chen names (processed rankings JSONs in rankings dir root)
  const borisSet = new Set<string>();
  const borisList: { raw: string; normalized: string }[] = [];
  const files = fs
    .readdirSync(borisDir)
    .filter((f) => f.endsWith("-rankings-raw.csv"));
  for (const f of files) {
    try {
      const csv = fs.readFileSync(path.join(borisDir, f), "utf8");
      const lines = csv.split(/\r?\n/).slice(1); // skip header
      for (const line of lines) {
        if (!line.trim()) continue;
        const cells = line.split(",");
        const rawName = cells[1]?.replace(/^"|"$/g, "") ?? ""; // Player.Name
        if (!rawName) continue;
        const norm = normalizePlayerName(rawName);
        borisSet.add(norm);
        borisList.push({ raw: rawName, normalized: norm });
      }
    } catch {
      // ignore
    }
  }

  // Collect FantasyPros names
  const fpRaw = readJson(fantasyProsAggPath);
  const fpSet = new Set<string>();
  const fpList: { raw: string; normalized: string }[] = [];
  let fpRows: any[] = [];
  if (Array.isArray(fpRaw)) {
    fpRows = fpRaw;
  } else if (fpRaw && typeof fpRaw === "object") {
    const container = fpRaw as any;
    if (Array.isArray(container.data)) {
      fpRows = container.data;
    } else if (Array.isArray(container.players)) {
      fpRows = container.players;
    } else {
      const values = Object.values(container);
      const firstArray = values.find((v) => Array.isArray(v));
      if (Array.isArray(firstArray)) fpRows = firstArray as any[];
    }
  }
  for (const row of fpRows) {
    const n = typeof row?.player_name === "string" ? row.player_name : "";
    if (n) {
      const norm = normalizePlayerName(n);
      fpSet.add(norm);
      fpList.push({ raw: n, normalized: norm });
    }
  }

  const missingInBoris: {
    raw: string;
    normalized: string;
    adp_std?: number;
  }[] = [];
  const missingInFp: { raw: string; normalized: string; adp_std?: number }[] =
    [];
  const adpByName = new Map<string, number>();
  for (const row of projections) {
    const first = row?.player?.first_name ?? "";
    const last = row?.player?.last_name ?? "";
    const raw = `${first} ${last}`.trim();
    const normalized = normalizePlayerName(raw);
    const adp = Number(
      row?.stats?.adp_std ?? row?.stats?.adp_ppr ?? row?.stats?.adp_half_ppr
    );
    if (Number.isFinite(adp)) adpByName.set(normalized, adp);
  }
  for (const item of topNames) {
    const adp = adpByName.get(item.normalized);
    if (!borisSet.has(item.normalized))
      missingInBoris.push({
        ...item,
        ...(adp !== undefined && { adp_std: adp }),
      });
    if (!fpSet.has(item.normalized))
      missingInFp.push({ ...item, ...(adp !== undefined && { adp_std: adp }) });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Checked top ${topNames.length} Sleeper names. Sources — Boris: ${borisSet.size} names, FantasyPros: ${fpSet.size} names.`
  );

  // Build fuzzy indices for suggestions
  const fuseFp = new Fuse(fpList, {
    keys: ["normalized"],
    includeScore: true,
    threshold: 0.3,
  });
  const fuseBoris = new Fuse(borisList, {
    keys: ["normalized"],
    includeScore: true,
    threshold: 0.3,
  });
  // Suggest close matches for first 20 examples
  const suggest = (
    items: { raw: string; normalized: string; adp_std?: number }[],
    fuse: Fuse<{ raw: string; normalized: string }>
  ) =>
    items.slice(0, 20).map((it) => {
      const res = fuse.search(it.normalized, { limit: 3 });
      const top = res[0];
      return {
        ...it,
        suggestion: top ? top.item.raw : null,
        score: top ? Number(top.score?.toFixed(3)) : null,
      };
    });

  console.log(
    `Missing in Boris Chen: ${missingInBoris.length} — with suggestions:`,
    suggest(missingInBoris, fuseBoris)
  );
  console.log(
    `Missing in FantasyPros: ${missingInFp.length} — with suggestions:`,
    suggest(missingInFp, fuseFp)
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
