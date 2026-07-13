import * as fs from "fs";
import * as path from "path";
import type { ScoringType } from "@/lib/schemas";
import type { CombinedEntryT } from "@/lib/schemas-aggregates";
import { FootballguysPublicRankingsSchema } from "@/lib/footballguysRankings";

export type AggregateSourceStatus = "ok" | "warning" | "missing";

export type AggregateSourceHealthItem = {
  source: "Sleeper" | "FantasyPros" | "Tiers" | "Footballguys";
  status: AggregateSourceStatus;
  lastUpdated: string | null;
  fetchedAt: string | null;
  rowCount: number | null;
  relevantRowCount: number | null;
  coveragePct: number | null;
  coverageBasis: string | null;
  sampleSize: string | null;
  projectionsFetched: boolean | null;
  warnings: string[];
};

export type AggregateSourceHealth = {
  generatedAt: string;
  scoring: ScoringType;
  sources: AggregateSourceHealthItem[];
  warnings: string[];
};

type MetadataRecord = {
  fetched_at?: unknown;
  fetchedAt?: unknown;
  last_updated?: unknown;
  lastUpdated?: unknown;
  row_count?: unknown;
  projections_fetched?: unknown;
  total_experts?: unknown;
  experts?: {
    coverage_pct?: unknown;
    sample_size?: unknown;
  };
};

type AggregateMetadata = {
  fp?: Record<string, Record<string, MetadataRecord>>;
  tiers?: Record<string, Record<string, MetadataRecord>>;
};

function scoringKey(scoring: ScoringType) {
  return scoring.toUpperCase();
}

function readMetadata(): AggregateMetadata | null {
  const metadataPath = path.resolve(
    process.cwd(),
    "public",
    "data",
    "aggregate",
    "metadata.json"
  );
  try {
    return JSON.parse(fs.readFileSync(metadataPath, "utf8")) as AggregateMetadata;
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function summarizeRecords(records: MetadataRecord[]) {
  if (records.length === 0) return null;
  const latestUpdated = records
    .map((record) => toIso(record.last_updated ?? record.lastUpdated))
    .filter((value): value is string => value != null)
    .sort()
    .at(-1);
  const latestFetched = records
    .map((record) => toIso(record.fetched_at ?? record.fetchedAt))
    .filter((value): value is string => value != null)
    .sort()
    .at(-1);
  const rowCount = records.reduce(
    (sum, record) => sum + (toNumber(record.row_count) ?? 0),
    0
  );
  const coverageValues = records
    .map((record) => toNumber(record.experts?.coverage_pct))
    .filter((value): value is number => value != null);
  const coveragePct =
    coverageValues.length > 0
      ? Math.round(
          coverageValues.reduce((sum, value) => sum + value, 0) /
            coverageValues.length
        )
      : null;
  const sampleSizes = new Set(
    records
      .map((record) => record.experts?.sample_size)
      .filter((value): value is string => typeof value === "string")
  );
  const sampleSize =
    sampleSizes.has("thin") || sampleSizes.has("limited")
      ? "limited"
      : sampleSizes.values().next().value ?? null;
  const projectionsFetched = records.every(
    (record) => record.projections_fetched === true
  );
  return {
    latestUpdated: latestUpdated ?? null,
    latestFetched: latestFetched ?? null,
    rowCount,
    relevantRowCount: rowCount,
    coveragePct,
    coverageBasis: coveragePct == null ? null : "expert",
    sampleSize,
    projectionsFetched,
  };
}

function statusFromWarnings(warnings: string[]): AggregateSourceStatus {
  return warnings.length > 0 ? "warning" : "ok";
}

const SOURCE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DRAFT_CAPACITY = 180;

function addFreshnessWarning(args: {
  warnings: string[];
  source: string;
  updatedAt: string | null;
  now: Date;
}) {
  if (!args.updatedAt) return;
  if (args.now.getTime() - new Date(args.updatedAt).getTime() > SOURCE_MAX_AGE_MS) {
    args.warnings.push(`${args.source} data is more than 7 days old.`);
  }
}

function fantasyProsHealth(
  metadata: AggregateMetadata | null,
  scoring: ScoringType,
  now: Date
) {
  const records = Object.values(metadata?.fp?.[scoringKey(scoring)] ?? {});
  const summary = summarizeRecords(records);
  if (!summary) {
    return {
      source: "FantasyPros",
      status: "missing",
      lastUpdated: null,
      fetchedAt: null,
      rowCount: null,
      relevantRowCount: null,
      coveragePct: null,
      coverageBasis: null,
      sampleSize: null,
      projectionsFetched: null,
      warnings: ["FantasyPros metadata is missing."],
    } satisfies AggregateSourceHealthItem;
  }

  const warnings: string[] = [];
  if (summary.sampleSize === "thin" || summary.sampleSize === "limited") {
    warnings.push("FantasyPros expert sample is limited.");
  }
  if ((summary.coveragePct ?? 100) < 50) {
    warnings.push("FantasyPros expert coverage is below 50%.");
  }
  addFreshnessWarning({
    warnings,
    source: "FantasyPros",
    updatedAt: summary.latestUpdated ?? summary.latestFetched,
    now,
  });

  return {
    source: "FantasyPros",
    status: statusFromWarnings(warnings),
    lastUpdated: summary.latestUpdated,
    fetchedAt: summary.latestFetched,
    rowCount: summary.rowCount,
    relevantRowCount: summary.relevantRowCount,
    coveragePct: summary.coveragePct,
    coverageBasis: summary.coverageBasis,
    sampleSize: summary.sampleSize,
    projectionsFetched: summary.projectionsFetched,
    warnings,
  } satisfies AggregateSourceHealthItem;
}

function tiersHealth(
  metadata: AggregateMetadata | null,
  scoring: ScoringType,
  now: Date
) {
  const records = Object.values(metadata?.tiers?.[scoringKey(scoring)] ?? {});
  const summary = summarizeRecords(records);
  if (!summary) {
    return {
      source: "Tiers",
      status: "missing",
      lastUpdated: null,
      fetchedAt: null,
      rowCount: null,
      relevantRowCount: null,
      coveragePct: null,
      coverageBasis: null,
      sampleSize: null,
      projectionsFetched: null,
      warnings: ["Tier metadata is missing."],
    } satisfies AggregateSourceHealthItem;
  }

  const warnings: string[] = [];
  if (summary.sampleSize === "thin" || summary.sampleSize === "limited") {
    warnings.push("Tier generation used a limited expert sample.");
  }
  addFreshnessWarning({
    warnings,
    source: "Tier",
    updatedAt: summary.latestUpdated ?? summary.latestFetched,
    now,
  });

  return {
    source: "Tiers",
    status: statusFromWarnings(warnings),
    lastUpdated: summary.latestUpdated,
    fetchedAt: summary.latestFetched,
    rowCount: summary.rowCount,
    relevantRowCount: summary.relevantRowCount,
    coveragePct: summary.coveragePct,
    coverageBasis: summary.coverageBasis,
    sampleSize: summary.sampleSize,
    projectionsFetched: null,
    warnings,
  } satisfies AggregateSourceHealthItem;
}

function numberField(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sleeperAdp(player: CombinedEntryT, scoring: ScoringType) {
  const stats = player.sleeper?.stats;
  return numberField(
    scoring === "std"
      ? stats?.adp_std
      : scoring === "half"
        ? stats?.adp_half_ppr
        : stats?.adp_ppr
  );
}

function hasDraftableSleeperAdp(player: CombinedEntryT, scoring: ScoringType) {
  const adp = sleeperAdp(player, scoring);
  return adp != null && adp < 900;
}

function hasTierForScoring(player: CombinedEntryT, scoring: ScoringType) {
  return player.tiers[scoring] != null;
}

function draftRank(player: CombinedEntryT, scoring: ScoringType) {
  const tierRank = player.tiers[scoring]?.rank;
  if (tierRank != null) return tierRank;
  const adp = sleeperAdp(player, scoring);
  return adp != null && adp < 900 ? adp : Number.MAX_SAFE_INTEGER;
}

function sleeperHealth(
  players: readonly CombinedEntryT[],
  scoring: ScoringType,
  draftCapacity: number,
  now: Date
) {
  const rowCount = players.length;
  const draftRelevantPlayers = players
    .filter(
      (player) =>
        hasTierForScoring(player, scoring) ||
        hasDraftableSleeperAdp(player, scoring)
    )
    .toSorted((a, b) => draftRank(a, scoring) - draftRank(b, scoring))
    .slice(0, draftCapacity);
  const relevantRowCount = draftRelevantPlayers.length;
  const withAdp = draftRelevantPlayers.filter((player) =>
    hasDraftableSleeperAdp(player, scoring)
  ).length;
  const latestUpdated = players
    .map((player) => toIso(player.sleeper.updated_at))
    .filter((value): value is string => value != null)
    .sort()
    .at(-1);
  const warnings: string[] = [];
  if (rowCount === 0) warnings.push("Sleeper aggregate rows are missing.");
  if (rowCount > 0 && relevantRowCount === 0) {
    warnings.push("Sleeper draft-relevant rows are missing.");
  }
  if (relevantRowCount > 0 && withAdp / relevantRowCount < 0.8) {
    warnings.push("Sleeper ADP coverage is below 80% for draft-relevant players.");
  }
  if (!latestUpdated) {
    warnings.push("Sleeper update timestamp is unavailable; using aggregate file freshness.");
  }
  addFreshnessWarning({
    warnings,
    source: "Sleeper",
    updatedAt: latestUpdated ?? null,
    now,
  });

  return {
    source: "Sleeper",
    status: rowCount === 0 ? "missing" : statusFromWarnings(warnings),
    lastUpdated: latestUpdated ?? null,
    fetchedAt: null,
    rowCount,
    relevantRowCount,
    coveragePct:
      relevantRowCount > 0
        ? Math.round((withAdp / relevantRowCount) * 100)
        : null,
    coverageBasis: `ADP among top ${draftCapacity} draft slots`,
    sampleSize: null,
    projectionsFetched: null,
    warnings,
  } satisfies AggregateSourceHealthItem;
}

function footballguysHealth(now: Date): AggregateSourceHealthItem {
  const filePath = path.resolve(
    process.cwd(),
    "public/data/aggregate/footballguys-rankings.json"
  );
  if (!fs.existsSync(filePath)) {
    return {
      source: "Footballguys",
      status: "missing",
      lastUpdated: null,
      fetchedAt: null,
      rowCount: null,
      relevantRowCount: null,
      coveragePct: null,
      coverageBasis: null,
      sampleSize: null,
      projectionsFetched: null,
      warnings: ["Footballguys public-default rankings are missing."],
    };
  }
  const data = FootballguysPublicRankingsSchema.parse(
    JSON.parse(fs.readFileSync(filePath, "utf8"))
  );
  const consensus = data.sources.find((source) => source.source === "consensus");
  const warnings = [
    "Footballguys rankings use public-default 12-team PPR settings, not this league's custom settings.",
  ];
  addFreshnessWarning({
    warnings,
    source: "Footballguys",
    updatedAt: data.fetchedAt,
    now,
  });
  return {
    source: "Footballguys",
    status: statusFromWarnings(warnings),
    lastUpdated: null,
    fetchedAt: data.fetchedAt,
    rowCount: data.rows.length,
    relevantRowCount: consensus?.adpRowCount ?? null,
    coveragePct: consensus?.adpCoveragePct ?? null,
    coverageBasis: "consensus ADP among Footballguys ranked players",
    sampleSize: null,
    projectionsFetched: null,
    warnings,
  };
}

export function getAggregateSourceHealth(args: {
  scoring: ScoringType;
  players: readonly CombinedEntryT[];
  draftCapacity?: number;
  now?: Date;
}): AggregateSourceHealth {
  const metadata = readMetadata();
  const now = args.now ?? new Date();
  const draftCapacity = Math.max(
    1,
    Math.floor(args.draftCapacity ?? DEFAULT_DRAFT_CAPACITY)
  );
  const sources = [
    sleeperHealth(args.players, args.scoring, draftCapacity, now),
    fantasyProsHealth(metadata, args.scoring, now),
    tiersHealth(metadata, args.scoring, now),
    footballguysHealth(now),
  ];
  return {
    generatedAt: now.toISOString(),
    scoring: args.scoring,
    sources,
    warnings: sources.flatMap((source) =>
      source.warnings.map((warning) => `${source.source}: ${warning}`)
    ),
  };
}
