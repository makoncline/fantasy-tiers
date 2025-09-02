import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SleeperProjection,
  fetchSleeperProjections,
} from "../../src/lib/sleeper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureDir(dirPath: string) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

function writeJsonPretty(filePath: string, data: unknown) {
  const json = JSON.stringify(data, null, 2);
  return fs.promises.writeFile(filePath, json, "utf8");
}

async function main() {
  const root = path.resolve(__dirname, "../../");
  const outDir = path.join(root, "public", "data", "sleeper");
  const rawDir = path.join(outDir, "raw");
  await ensureDir(rawDir);

  const season = process.env.SEASON ?? new Date().getFullYear().toString();
  const week = process.env.WEEK ?? undefined;
  const seasonType = process.env.SEASON_TYPE ?? "regular";
  const positions = ["DEF", "K", "QB", "RB", "TE", "WR"];
  const orderBy = process.env.ORDER_BY ?? "adp_half_ppr";

  const startedAt = new Date();

  const projections: SleeperProjection[] = await fetchSleeperProjections(
    season,
    {
      seasonType,
      positions,
      orderBy,
      ...(week !== undefined && { week }),
      sport: "nfl",
    }
  );

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const baseName = week
    ? `projections-${season}-w${week}`
    : `projections-${season}`;
  const rawFile = path.join(rawDir, `${baseName}-${stamp}.json`);
  const latestFile = path.join(outDir, `projections-latest.json`);
  const metaFile = path.join(rawDir, `metadata-${baseName}-${stamp}.json`);

  await Promise.all([
    writeJsonPretty(rawFile, projections),
    writeJsonPretty(latestFile, projections),
    writeJsonPretty(metaFile, {
      provider: "sleeper",
      type: "projections",
      positions,
      orderBy,
      season,
      seasonType,
      week: week ?? null,
      recordCount: projections.length,
      updatedAt: new Date().toISOString(),
      source: "https://api.sleeper.com/projections/nfl",
      files: {
        raw: path.relative(root, rawFile),
        latest: path.relative(root, latestFile),
      },
    }),
  ]);

  // Also emit per-position raw files for convenience
  const byPos: Record<string, SleeperProjection[]> = {};
  for (const p of positions) byPos[p] = [];
  for (const row of projections) {
    const pos = row.player.position ?? "UNK";
    if (!byPos[pos]) byPos[pos] = [];
    byPos[pos].push(row);
  }

  await Promise.all(
    Object.entries(byPos).map(([pos, arr]) =>
      writeJsonPretty(
        path.join(rawDir, `${baseName}-${pos}-${stamp}.json`),
        arr
      )
    )
  );

  // eslint-disable-next-line no-console
  console.log(
    `Saved Sleeper projections: ${projections.length} records → ${path.relative(
      root,
      rawFile
    )} and ${path.relative(root, latestFile)}`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
