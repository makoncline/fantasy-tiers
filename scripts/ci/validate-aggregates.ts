#!/usr/bin/env -S node --experimental-strip-types --enable-source-maps
/**
 * CI validation script for aggregate data files
 * This script validates that all aggregate JSON files conform to the strict schema
 * and can be used as a CI step to prevent regressions.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CombinedShard } from "../../src/lib/schemas-aggregates";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function validateAggregateFiles(): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  const root = path.resolve(__dirname, "../../");
  const dir = path.join(root, "public/data/aggregate");
  const shards = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF", "FLEX"];

  console.log("🔍 Validating aggregate data files...");

  for (const s of shards) {
    const fp = path.join(dir, `${s}-combined-aggregate.json`);

    if (!fs.existsSync(fp)) {
      errors.push(`Missing aggregate file: ${s}-combined-aggregate.json`);
      continue;
    }

    try {
      const data = readJson(fp);
      CombinedShard.parse(data);
      console.log(`✅ ${s} shard validated successfully`);
    } catch (error: any) {
      errors.push(`${s} shard validation failed: ${error.message}`);
      console.log(`❌ ${s} shard validation failed`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

async function main() {
  const result = validateAggregateFiles();

  if (result.success) {
    console.log("\n🎉 All aggregate files passed validation!");
    process.exit(0);
  } else {
    console.log("\n💥 Aggregate validation failed:");
    result.errors.forEach((error) => console.log(`  - ${error}`));
    console.log("\nTo regenerate valid aggregate files, run:");
    console.log("  pnpm run agg:combined");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unexpected error during validation:", e);
  process.exit(1);
});
