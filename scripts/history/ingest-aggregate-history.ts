import { createRatingHistoryDb } from "../../src/lib/ratingHistory/db";
import {
  ingestAggregateHistory,
  loadAggregateHistoryInputs,
} from "../../src/lib/ratingHistory/ingestAggregates";
import { migrateRatingHistoryDb } from "../../src/lib/ratingHistory/migrate";

async function main() {
  const db = createRatingHistoryDb();
  try {
    await migrateRatingHistoryDb(db);
    const input = loadAggregateHistoryInputs();
    const stats = await ingestAggregateHistory(db, input);
    // eslint-disable-next-line no-console
    console.log("Ingested aggregate rating history:", stats);
  } finally {
    db.$client.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
