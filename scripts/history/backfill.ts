import fs from "node:fs";
import path from "node:path";
import { backfillRatingHistory } from "../../src/lib/ratingHistory/backfill";
import {
  defaultRatingHistoryDatabaseUrl,
  resolveRatingHistoryDatabaseConfig,
} from "../../src/lib/ratingHistory/db";

async function main() {
  const sourceUrl = process.env.FANTASY_HISTORY_BACKFILL_SOURCE_URL ??
    defaultRatingHistoryDatabaseUrl();
  if (sourceUrl.startsWith("file:")) {
    const sourcePath = sourceUrl.slice("file:".length);
    if (!fs.existsSync(path.resolve(sourcePath))) {
      throw new Error("Local rating history source database does not exist");
    }
  }

  const target = resolveRatingHistoryDatabaseConfig();
  if (!target.available || target.storage !== "remote") {
    throw new Error(
      "Backfill requires FANTASY_HISTORY_DATABASE_URL and FANTASY_HISTORY_DATABASE_AUTH_TOKEN for a remote target"
    );
  }

  const result = await backfillRatingHistory({ url: sourceUrl }, target.config);
  console.log("Rating history backfill verified:", result);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
