import fs from "node:fs";
import path from "node:path";
import type { ScoringType } from "./schemas";

type SourceUpdate = {
  source: "Tiers";
  lastUpdated: Date | null;
  fetchedAt: Date | null;
  details: Record<string, unknown>;
};

type MetadataRecord = {
  last_updated?: unknown;
  last_modified?: unknown;
  fetched_at?: unknown;
  fetchedAt?: unknown;
  [key: string]: unknown;
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function empty(details: Record<string, unknown> = {}): SourceUpdate {
  return {
    source: "Tiers",
    lastUpdated: null,
    fetchedAt: null,
    details,
  };
}

export function getTiersUpdateDate(
  position: string,
  scoring: ScoringType
): SourceUpdate {
  const metadataPath = path.join(
    process.cwd(),
    "public",
    "data",
    "aggregate",
    "metadata.json"
  );

  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as {
      tiers?: Record<string, Record<string, MetadataRecord>>;
    };
    const scoringKey =
      position === "K" || position === "DEF" ? "STD" : scoring.toUpperCase();
    const positionKey = position === "DEF" ? "DST" : position;
    const record = parsed.tiers?.[scoringKey]?.[positionKey];
    if (!record) {
      return empty({ error: "metadata record not found" });
    }

    return {
      source: "Tiers",
      lastUpdated: parseDate(record.last_updated ?? record.last_modified),
      fetchedAt: parseDate(record.fetched_at ?? record.fetchedAt),
      details: record,
    };
  } catch (error) {
    return empty({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
