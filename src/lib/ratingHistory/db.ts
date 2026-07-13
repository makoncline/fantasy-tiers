import fs from "node:fs";
import path from "node:path";
import { createClient, type Config } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { z } from "zod";
import { ratingHistorySchema } from "./schema";

export type RatingHistoryDatabase = LibSQLDatabase<typeof ratingHistorySchema>;

const RemoteUrlSchema = z
  .string()
  .min(1)
  .refine(
    (url) =>
      url.startsWith("libsql://") ||
      url.startsWith("https://") ||
      url.startsWith("http://"),
    "Remote rating history URL must use libsql or HTTP(S)"
  );

export type RatingHistoryConfigResult =
  | { available: true; config: Config; storage: "local" | "remote" }
  | {
      available: false;
      reason:
        | "not-configured"
        | "auth-token-missing"
        | "local-file-in-production"
        | "invalid-url";
    };

type RatingHistoryUnavailableReason = Extract<
  RatingHistoryConfigResult,
  { available: false }
>["reason"];

export class RatingHistoryUnavailableError extends Error {
  constructor(readonly reason: RatingHistoryUnavailableReason) {
    super(`Rating history database is unavailable: ${reason}`);
    this.name = "RatingHistoryUnavailableError";
  }
}

export function defaultRatingHistoryDatabaseUrl() {
  return `file:${path.resolve(process.cwd(), "data", "fantasy-history.db")}`;
}

export function resolveRatingHistoryDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env
): RatingHistoryConfigResult {
  const url = env.FANTASY_HISTORY_DATABASE_URL;
  const authToken = env.FANTASY_HISTORY_DATABASE_AUTH_TOKEN;
  const isProduction = env.NODE_ENV === "production" || Boolean(env.VERCEL);

  if (!url) {
    if (isProduction) return { available: false, reason: "not-configured" };
    return {
      available: true,
      config: { url: defaultRatingHistoryDatabaseUrl() },
      storage: "local",
    };
  }

  if (url.startsWith("file:")) {
    if (isProduction) {
      return { available: false, reason: "local-file-in-production" };
    }
    return { available: true, config: { url }, storage: "local" };
  }

  if (!RemoteUrlSchema.safeParse(url).success) {
    return { available: false, reason: "invalid-url" };
  }
  if (!authToken) {
    return { available: false, reason: "auth-token-missing" };
  }
  return {
    available: true,
    config: { url, authToken },
    storage: "remote",
  };
}

export function ratingHistoryDatabaseConfig(): Config {
  const result = resolveRatingHistoryDatabaseConfig();
  if (!result.available) throw new RatingHistoryUnavailableError(result.reason);
  if (result.storage === "local") {
    const filePath = result.config.url.slice("file:".length);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  return result.config;
}

export function createRatingHistoryDb(
  config: Config = ratingHistoryDatabaseConfig()
) {
  const client = createClient(config);
  return drizzle(client, { schema: ratingHistorySchema });
}
