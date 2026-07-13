import fs from "node:fs";
import path from "node:path";

import {
  RatingHistoryDashboardSchema,
  type RatingHistoryDashboard,
} from "./dashboard";

export const RATING_HISTORY_DASHBOARD_SNAPSHOT_PATH = path.join(
  "public",
  "data",
  "aggregate",
  "rating-history-dashboard.json"
);

export function readRatingHistoryDashboardSnapshot(
  root = process.cwd()
): RatingHistoryDashboard {
  const filePath = path.join(root, RATING_HISTORY_DASHBOARD_SNAPSHOT_PATH);
  return RatingHistoryDashboardSchema.parse(
    JSON.parse(fs.readFileSync(filePath, "utf8"))
  );
}
