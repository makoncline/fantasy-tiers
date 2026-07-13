import { defineConfig } from "drizzle-kit";

const url =
  process.env.FANTASY_HISTORY_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "file:./data/fantasy-history.db";
const authToken =
  process.env.FANTASY_HISTORY_DATABASE_AUTH_TOKEN ??
  process.env.DATABASE_AUTH_TOKEN;

export default defineConfig({
  schema: "./src/lib/ratingHistory/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: authToken ? { url, authToken } : { url },
});
