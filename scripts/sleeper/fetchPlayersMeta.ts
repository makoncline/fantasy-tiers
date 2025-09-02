#!/usr/bin/env -S node --experimental-strip-types --enable-source-maps

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchSleeperPlayersMeta,
  SleeperPlayersMetaSchema,
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

  const startedAt = new Date();
  const data = await fetchSleeperPlayersMeta();
  const validated = SleeperPlayersMetaSchema.parse(data);

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const rawFile = path.join(rawDir, `players-meta-${stamp}.json`);
  const latestRawFile = path.join(rawDir, `players-meta-latest.json`);

  await Promise.all([
    writeJsonPretty(rawFile, validated),
    writeJsonPretty(latestRawFile, validated),
  ]);

  // eslint-disable-next-line no-console
  console.log(
    `Saved Sleeper players meta → ${path.relative(
      root,
      latestRawFile
    )} and ${path.relative(root, rawFile)}`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
