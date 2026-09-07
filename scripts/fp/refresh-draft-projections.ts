import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { scrapeOne } from "./scrape-fantasypros";
import { loadFantasyProsProjectionSource } from "../../src/lib/fantasyProsProjectionSource";

/** Fetch one full table per offensive position. Never replace the published file with a partial run. */
export async function refreshDraftProjections({
  output = path.resolve("public/data/aggregate/fantasypros-draft-projections.json"),
  scrape = scrapeOne,
  now = new Date(),
} = {}) {
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), "fantasy-fp-refresh-"));
  try {
    for (const position of ["QB", "RB", "WR", "TE"] as const) await scrape(position, "HALF", "draft", staging);
    const source = loadFantasyProsProjectionSource(path.join(staging, "raw"));
    const date = Date.parse(source.updatedAt ?? "");
    if (!Number.isFinite(date) || now.getTime() - date > 72 * 3600_000 || date > now.getTime() + 86400_000) source.problems.push("FP projection source date is stale or invalid.");
    if (source.problems.length) throw new Error(source.problems.join(" "));
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(`${output}.tmp`, JSON.stringify(source, null, 2));
    await fs.rename(`${output}.tmp`, output);
    return { rows: source.rows.length, updatedAt: source.updatedAt };
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  // This path uses the signed-in website session. The truncated public API is not polled.
  refreshDraftProjections().then(result => console.log(result)).catch(() => {
    console.error("FP refresh failed. Previous snapshot retained. Check session access, table completeness, and source date.");
    process.exitCode = 1;
  });
}
