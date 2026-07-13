import { createRatingHistoryDb } from "../../src/lib/ratingHistory/db";
import { migrateRatingHistoryDb } from "../../src/lib/ratingHistory/migrate";

async function main() {
  const db = createRatingHistoryDb();
  try {
    await migrateRatingHistoryDb(db);
    // eslint-disable-next-line no-console
    console.log("Rating history database is ready.");
  } finally {
    db.$client.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
