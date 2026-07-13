import { readFile } from "node:fs/promises";

import { parse } from "csv-parse/sync";

import {
  DEFAULT_PLAYER_ID_CACHE_PATH,
  loadPlayerIdCache,
  savePlayerIdCache,
  upsertPlayerIdCache,
} from "./player-id-cache";

const DEFAULT_FFB_IDS_URL =
  "https://raw.githubusercontent.com/mayscopeland/ffb_ids/main/player_ids.csv";

type Args = {
  cachePath?: string;
  input?: string;
  url?: string;
};

type FfbIdsRow = {
  sleeper_id?: string;
  sleeper_name?: string;
  footballguys_id?: string;
  footballguys_name?: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cachePath = args.cachePath ?? DEFAULT_PLAYER_ID_CACHE_PATH;
  const csvText = args.input
    ? await readFile(args.input, "utf8")
    : await fetchCsv(args.url ?? DEFAULT_FFB_IDS_URL);
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as FfbIdsRow[];

  const cache = loadPlayerIdCache(cachePath);
  let imported = 0;
  for (const row of rows) {
    if (!row.sleeper_id || !row.footballguys_id) continue;
    upsertPlayerIdCache(cache, {
      footballguysId: row.footballguys_id,
      label: row.footballguys_name,
      name: row.sleeper_name ?? row.footballguys_name,
      sleeperId: row.sleeper_id,
      source: "ffb_ids",
    });
    imported += 1;
  }
  await savePlayerIdCache(cache, cachePath);
  console.log(
    JSON.stringify(
      {
        cachePath,
        imported,
        bySleeperId: Object.keys(cache.bySleeperId).length,
        byNamePosition: Object.keys(cache.byNamePosition).length,
      },
      null,
      2
    )
  );
}

async function fetchCsv(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
      "user-agent": "fantasy-tiers-local-tool",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ffb_ids CSV: ${response.status} ${url}`);
  }
  return response.text();
}

function parseArgs(args: string[]): Args {
  const parsed: Args = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--cache") {
      parsed.cachePath = requireArg(args, (index += 1), arg);
    } else if (arg === "--input") {
      parsed.input = requireArg(args, (index += 1), arg);
    } else if (arg === "--url") {
      parsed.url = requireArg(args, (index += 1), arg);
    } else if (arg === "--") {
      continue;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function requireArg(args: string[], index: number, flag: string) {
  const value = args[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
