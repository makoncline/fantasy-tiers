import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildFootballguysPublicRankings,
  buildFootballguysRankingsUrl,
  FOOTBALLGUYS_ADP_SOURCES,
  type FootballguysAdpSource,
  FootballguysRankingsFileSchema,
  type FootballguysRankingsFile,
  isFootballguysRankingsRoadblocked,
  parseFootballguysRankingsHtml,
} from "../../src/lib/footballguysRankings";

const OUTPUT_DIR = "data/footballguys/rankings";
const PUBLIC_OUTPUT = "public/data/aggregate/footballguys-rankings.json";
const scoring: "ppr" = "ppr";
const settings = {
  season: "2026",
  scoring,
  teams: 12,
  roster: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 },
};

void main();

async function main() {
  loadEnvFile("data/footballguys-session.env");
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const datasets = process.argv.includes("--from-cache")
    ? await readCachedRankings()
    : await fetchRankings();
  const publicRankings = buildFootballguysPublicRankings(datasets);
  await writeJsonAtomic(PUBLIC_OUTPUT, publicRankings);
  console.log(`public lookup: ${publicRankings.rows.length} ranked players`);
}

async function fetchRankings() {
  const cookie = process.env.FBG_COOKIE;
  const userAgent = process.env.FBG_USER_AGENT ?? "fantasy-tiers/0.1 rankings refresh";
  const datasets: Array<{
    source: FootballguysAdpSource;
    data: FootballguysRankingsFile;
  }> = [];
  for (const [index, adpSource] of FOOTBALLGUYS_ADP_SOURCES.entries()) {
    if (index > 0) await delay(1_000);
    const sourceUrl = buildFootballguysRankingsUrl({ ...settings, adpSource });
    const response = await fetch(sourceUrl, {
      headers: {
        "user-agent": userAgent,
        ...(cookie ? { cookie } : {}),
      },
    });
    if (!response.ok) throw new Error(`Footballguys ${adpSource} returned ${response.status}`);
    const html = await response.text();
    if (isFootballguysRankingsRoadblocked(html)) {
      throw new Error(
        "Footballguys public-default rankings are unavailable."
      );
    }
    const rows = parseFootballguysRankingsHtml(html);
    if (rows.length < 100) {
      throw new Error(`Footballguys ${adpSource} returned only ${rows.length} ranking rows`);
    }
    const adpRowCount = rows.filter((row) => row.adp != null).length;
    const adpCoveragePct = Math.round((adpRowCount / rows.length) * 1_000) / 10;
    const warnings = adpRowCount === 0
      ? [`${adpSource} currently has no ADP values for these league settings.`]
      : [];
    const output = FootballguysRankingsFileSchema.parse({
      ...settings,
      access: "public-default",
      adpSource,
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      adpRowCount,
      adpCoveragePct,
      warnings,
      rows,
    });
    const outputPath = cachePath(adpSource);
    await writeJsonAtomic(outputPath, output);
    datasets.push({ source: adpSource, data: output });
    console.log(`${adpSource}: ${rows.length} ranks, ${adpRowCount} ADP values`);
  }
  return datasets;
}

async function readCachedRankings() {
  return Promise.all(
    FOOTBALLGUYS_ADP_SOURCES.map(async (source) => ({
      source,
      data: FootballguysRankingsFileSchema.parse(
        JSON.parse(await fs.readFile(cachePath(source), "utf8"))
      ),
    }))
  );
}

function cachePath(source: FootballguysAdpSource) {
  return path.join(OUTPUT_DIR, `${settings.scoring}-${source}.json`);
}

async function writeJsonAtomic(outputPath: string, value: unknown) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporaryPath, outputPath);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnvFile(envPath: string) {
  try {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || !match[1] || process.env[match[1]] != null) continue;
      process.env[match[1]] = unquote(match[2] ?? "");
    }
  } catch {
    return;
  }
}

function unquote(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
