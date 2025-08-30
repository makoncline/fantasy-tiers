#!/usr/bin/env -S node --experimental-strip-types --enable-source-maps

import { execFileSync } from "node:child_process";

function run(cmd: string, args: string[]) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

async function main() {
  // Fetch all sources only (no aggregation)
  run("pnpm", ["run", "fetch:sleeper:projections"]);
  run("pnpm", ["run", "fetch:sleeper:players-meta"]);
  run("pnpm", ["run", "fetch:fp"]);
  run("pnpm", ["run", "fetch:borischen"]);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
