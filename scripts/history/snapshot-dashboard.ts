import fs from "node:fs/promises";
import path from "node:path";

import {
  createRatingHistoryDb,
  ratingHistoryDatabaseConfig,
} from "../../src/lib/ratingHistory/db";
import {
  getRatingHistoryDashboard,
  RatingHistoryDashboardSchema,
} from "../../src/lib/ratingHistory/dashboard";
import { RATING_HISTORY_DASHBOARD_SNAPSHOT_PATH } from "../../src/lib/ratingHistory/dashboardSnapshot";

async function main() {
  const db = createRatingHistoryDb(ratingHistoryDatabaseConfig());
  try {
    const dashboard = RatingHistoryDashboardSchema.parse(
      await getRatingHistoryDashboard(db)
    );
    const filePath = path.resolve(RATING_HISTORY_DASHBOARD_SNAPSHOT_PATH);
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(dashboard, null, 2)}\n`,
      "utf8"
    );
    await fs.rename(temporaryPath, filePath);
    console.log(`Wrote rating history dashboard snapshot to ${filePath}`);
  } finally {
    db.$client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
