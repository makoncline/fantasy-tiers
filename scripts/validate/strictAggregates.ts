#!/usr/bin/env -S node --experimental-strip-types --enable-source-maps
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CombinedShard } from "../../src/lib/schemas-aggregates";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function summarize(errors: z.ZodError[]) {
  const counts = new Map<string, number>();
  for (const e of errors) {
    for (const issue of e.issues) {
      const key = `${issue.path.join(".")} :: ${issue.code}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function getDetailedErrors(errors: z.ZodError[]) {
  const details: string[] = [];
  for (const error of errors) {
    for (const issue of error.issues.slice(0, 5)) {
      // Limit to first 5 issues per error
      const path = issue.path.join(".");
      const received = (issue as any).received || "unknown";
      details.push(`${path}: expected ${issue.code}, received ${received}`);
    }
  }
  return [...new Set(details)]; // Remove duplicates
}

async function main() {
  const root = path.resolve(__dirname, "../../");
  const dir = path.join(root, "public/data/aggregate");
  const shards = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF", "FLEX"];

  const errors: z.ZodError[] = [];
  for (const s of shards) {
    const fp = path.join(dir, `${s}-combined-aggregate.json`);
    if (!fs.existsSync(fp)) continue;
    const data = readJson(fp);
    const res = CombinedShard.safeParse(data);
    if (!res.success) errors.push(res.error);
  }

  if (!errors.length) {
    console.log("All aggregate shards passed strict validation.");
    return;
  }

  console.log("Strict validation issues (top 20):");
  for (const [k, v] of summarize(errors).slice(0, 20)) {
    console.log(`${v}x ${k}`);
  }

  console.log("\nDetailed error examples:");
  const details = getDetailedErrors(errors);
  for (const detail of details.slice(0, 10)) {
    console.log(`- ${detail}`);
  }

  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
