import fs from "fs";
import path from "path";

// Utility functions to extract source update dates

interface SleeperProjection {
  last_modified?: number;
  [key: string]: unknown;
}

interface SleeperMetadata {
  updatedAt: number;
  [key: string]: unknown;
}

interface SourceDetails {
  recordCount?: number;
  latestTimestamp?: number;
  metadata?: SleeperMetadata;
  [key: string]: unknown;
}

export interface SourceUpdateInfo {
  source: string;
  lastUpdated: Date | null;
  fetchedAt: Date | null;
  details: SourceDetails;
}

/**
 * Get Borischen source update date from aggregated metadata
 * Uses the Last-Modified HTTP header from S3
 */
export function getBorischenUpdateDate(
  position: string,
  scoring: string
): SourceUpdateInfo {
  const aggregateMetadataPath = path.join(
    process.cwd(),
    "public/data/aggregate/metadata.json"
  );

  try {
    const aggregateMetadata = JSON.parse(
      fs.readFileSync(aggregateMetadataPath, "utf8")
    );

    // Map position and scoring to match metadata structure
    const scoringKey = scoring.toUpperCase() as "STD" | "PPR" | "HALF";
    const positionKey = position === "DEF" ? "DST" : position;
    const actualScoringKey =
      position === "K" || position === "DEF" ? "STD" : scoringKey;

    const borischenData =
      aggregateMetadata?.borischen?.[actualScoringKey]?.[positionKey];
    const lastModified = borischenData?.last_modified;

    return {
      source: "Borischen",
      lastUpdated: lastModified ? new Date(lastModified) : null,
      fetchedAt: null, // Not stored separately
      details: { position, scoring, borischenData },
    };
  } catch (error) {
    return {
      source: "Borischen",
      lastUpdated: null,
      fetchedAt: null,
      details: {
        error: error instanceof Error ? error.message : String(error),
        position,
        scoring,
      },
    };
  }
}

/**
 * Get FantasyPros source update date from metadata files
 * Uses the last_updated_ts field extracted from the page
 */
export function getFantasyProsUpdateDate(
  position: string,
  scoring: string
): SourceUpdateInfo {
  const metadataPath = path.join(
    process.cwd(),
    "public/data/fantasypros/raw",
    `${position}-${scoring.toLowerCase()}-draft-metadata.json`
  );

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const date = metadata.date;

    return {
      source: "FantasyPros",
      lastUpdated: date ? new Date(date) : null,
      fetchedAt: metadata.scrapedAt ? new Date(metadata.scrapedAt) : null,
      details: { position, scoring, sources: metadata.sources, metadata },
    };
  } catch (error) {
    return {
      source: "FantasyPros",
      lastUpdated: null,
      fetchedAt: null,
      details: {
        error: error instanceof Error ? error.message : String(error),
        position,
        scoring,
      },
    };
  }
}

/**
 * Get Sleeper source update date from projection data
 * Uses the latest last_modified timestamp from all projections
 */
export function getSleeperUpdateDate(): SourceUpdateInfo {
  const projectionsPath = path.join(
    process.cwd(),
    "public/data/sleeper/projections-latest.json"
  );

  try {
    const projections = JSON.parse(fs.readFileSync(projectionsPath, "utf8"));
    const timestamps = (projections as SleeperProjection[])
      .map((p) => p.last_modified)
      .filter((ts): ts is number => ts != null);

    const latestTimestamp = Math.max(...timestamps);
    const metadataPath = path.join(
      process.cwd(),
      "public/data/sleeper/raw",
      fs
        .readdirSync(path.join(process.cwd(), "public/data/sleeper/raw"))
        .filter((f) => f.startsWith("metadata-projections-"))
        .sort()
        .pop()!
    );

    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    return {
      source: "Sleeper",
      lastUpdated: latestTimestamp ? new Date(latestTimestamp) : null,
      fetchedAt: new Date(metadata.updatedAt),
      details: {
        recordCount: projections.length,
        latestTimestamp,
        metadata,
      },
    };
  } catch (error) {
    return {
      source: "Sleeper",
      lastUpdated: null,
      fetchedAt: null,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Get all source update dates
 */
export function getAllSourceUpdateDates(): Record<string, SourceUpdateInfo> {
  return {
    borischenQB: getBorischenUpdateDate("QB", "std"),
    borischenRB: getBorischenUpdateDate("RB", "std"),
    borischenWR: getBorischenUpdateDate("WR", "std"),
    borischenTE: getBorischenUpdateDate("TE", "std"),
    fantasyProsQB: getFantasyProsUpdateDate("QB", "std"),
    fantasyProsRB: getFantasyProsUpdateDate("RB", "std"),
    fantasyProsWR: getFantasyProsUpdateDate("WR", "std"),
    fantasyProsTE: getFantasyProsUpdateDate("TE", "std"),
    sleeper: getSleeperUpdateDate(),
  };
}

/**
 * Format source update info for display
 */
export function formatSourceUpdateInfo(info: SourceUpdateInfo): string {
  const updatedStr = info.lastUpdated
    ? info.lastUpdated.toLocaleString()
    : "Unknown";

  const fetchedStr = info.fetchedAt
    ? info.fetchedAt.toLocaleString()
    : "Unknown";

  return `${info.source}: Updated ${updatedStr}, Fetched ${fetchedStr}`;
}
