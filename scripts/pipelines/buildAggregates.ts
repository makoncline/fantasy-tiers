#!/usr/bin/env -S node --experimental-strip-types --enable-source-maps

import { execFileSync } from "node:child_process";

function run(cmd: string, args: string[]) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

async function main() {
  // Build per-source aggregates first
  run("pnpm", ["run", "aggregate:fp"]);
  run("pnpm", ["run", "parse-data"]); // boris chen parse/aggregate pipeline

  // Build overall combined aggregates
  run("pnpm", ["run", "build:combined-aggregate"]);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
