import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull, desc } from "drizzle-orm";
import type { ScoringType } from "../schemas";
import { CombinedShard, type CombinedEntryT } from "../schemas-aggregates";
import { scoringKeys } from "../scoring";
import { historyPlayers, playerRatingVersions, sourceRuns } from "./schema";
import type {
  NewPlayerRatingVersion,
  NewSourceRun,
  PlayerRatingVersion,
} from "./schema";
import type { RatingHistoryDatabase } from "./db";
import { hashValue, stableJson } from "./hash";

const SHARDS = ["QB", "RB", "WR", "TE", "K", "DEF", "FLEX", "ALL"] as const;
const PRIMARY_POSITION_SHARDS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const SCORINGS = ["std", "half", "ppr"] as const satisfies ScoringType[];

type ShardName = (typeof SHARDS)[number];
type PrimaryPositionShard = (typeof PRIMARY_POSITION_SHARDS)[number];
type AggregateShards = Partial<Record<ShardName, Record<string, CombinedEntryT>>>;
type AggregateMetadata = {
  fp?: Record<string, Record<string, Record<string, unknown>>>;
  tiers?: Record<string, Record<string, Record<string, unknown>>>;
  expert_samples?: Record<string, unknown>;
};

type RatingIdentity = Pick<
  NewPlayerRatingVersion,
  | "playerId"
  | "source"
  | "mode"
  | "season"
  | "week"
  | "scoring"
  | "positionScope"
>;

type RatingInput = RatingIdentity &
  Pick<
    NewPlayerRatingVersion,
    | "rankOverall"
    | "rankPosition"
    | "tier"
    | "points"
    | "adp"
    | "rosterPct"
    | "sleeperSearchRank"
    | "sourceStatus"
    | "rawJson"
  >;

type IngestStats = {
  sourceRuns: number;
  playerUpserts: number;
  ratingVersionsInserted: number;
  ratingVersionsUnchanged: number;
  ratingVersionsClosed: number;
};

type SourceRunScope = {
  source: string;
  mode: string;
  season: number | null;
  week: number | null;
  scoring: ScoringType;
  position: string;
  fetchedAt: string;
  sourceLastUpdated: string | null;
  rowCount: number | null;
  expertSampleJson: string | null;
  metadataJson: string | null;
  contentHash: string;
};

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadAggregateHistoryInputs(root = process.cwd()): {
  shards: AggregateShards;
  metadata: AggregateMetadata;
} {
  const aggregateDir = path.join(root, "public", "data", "aggregate");
  const shards: AggregateShards = {};

  for (const shard of SHARDS) {
    const shardPath = path.join(aggregateDir, `${shard}-combined-aggregate.json`);
    if (!fs.existsSync(shardPath)) continue;
    shards[shard] = CombinedShard.parse(readJson(shardPath));
  }

  const metadataPath = path.join(aggregateDir, "metadata.json");
  const metadata = fs.existsSync(metadataPath)
    ? (readJson(metadataPath) as AggregateMetadata)
    : {};

  return { shards, metadata };
}

function upperScoring(scoring: ScoringType) {
  return scoring.toUpperCase() as "STD" | "HALF" | "PPR";
}

function metadataFor(
  metadata: AggregateMetadata,
  source: "fp" | "tiers",
  position: string,
  scoring: ScoringType
) {
  const scoringKey =
    position === "K" || position === "DEF" || position === "DST"
      ? "STD"
      : upperScoring(scoring);
  const positionKey = position === "DEF" ? "DST" : position;
  return metadata[source]?.[scoringKey]?.[positionKey] ?? null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[,%]/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value: unknown): number | null {
  const number = numberOrNull(value);
  return number == null ? null : Math.round(number);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractSeason(meta: Record<string, unknown> | null): number | null {
  return integerOrNull(meta?.year ?? meta?.season);
}

function extractWeek(meta: Record<string, unknown> | null): number | null {
  const week = meta?.week;
  if (week === "draft") return null;
  return integerOrNull(week);
}

function extractMode(
  meta: Record<string, unknown> | null,
  fallback: string
): string {
  return stringOrNull(meta?.mode) ?? fallback;
}

function sourceStatus(...values: Array<number | null>) {
  return values.some((value) => value != null) ? "present" : "absent";
}

function parseFpPositionRank(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  return numberOrNull(value.match(/\d+/)?.[0]);
}

function fpStatsPoints(entry: CombinedEntryT, scoring: ScoringType) {
  const { fpKey } = scoringKeys(scoring);
  const stats = entry.fantasypros?.stats?.[fpKey];
  if (!stats) return null;
  return numberOrNull(stats.FPTS) ?? numberOrNull(stats.FPTS_AVG);
}

function sleeperValues(entry: CombinedEntryT, scoring: ScoringType) {
  const { sleeperSuffix } = scoringKeys(scoring);
  return {
    adp: numberOrNull(entry.sleeper.stats[`adp_${sleeperSuffix}`]),
    points: numberOrNull(entry.sleeper.stats[`pts_${sleeperSuffix}`]),
  };
}

function runScopeHash(
  source: string,
  mode: string,
  position: string,
  scoring: ScoringType,
  ratings: readonly RatingInput[],
  metadata: Record<string, unknown> | null
) {
  return hashValue({
    source,
    mode,
    position,
    scoring,
    metadata,
    ratings: ratings.map((rating) => ({
      playerId: rating.playerId,
      rankOverall: rating.rankOverall,
      rankPosition: rating.rankPosition,
      tier: rating.tier,
      points: rating.points,
      adp: rating.adp,
      rosterPct: rating.rosterPct,
      sleeperSearchRank: rating.sleeperSearchRank,
      sourceStatus: rating.sourceStatus,
    })),
  });
}

function buildTiersRatings(
  entries: CombinedEntryT[],
  position: ShardName,
  scoring: ScoringType,
  metadata: AggregateMetadata
): { run: SourceRunScope; ratings: RatingInput[] } {
  const meta = metadataFor(metadata, "tiers", position, scoring);
  const season = extractSeason(meta);
  const mode = extractMode(meta, "draft");
  const fetchedAt = stringOrNull(meta?.fetched_at) ?? new Date().toISOString();
  const sourceLastUpdated = stringOrNull(meta?.last_updated);

  const ratings = entries.map((entry) => {
    const tier = entry.tiers[scoring] ?? null;
    const rankOverall = numberOrNull(tier?.rank);
    const tierLevel = numberOrNull(tier?.tier);
    return {
      playerId: entry.player_id,
      source: "tiers",
      mode,
      season,
      week: null,
      scoring,
      positionScope: position,
      rankOverall,
      rankPosition: null,
      tier: tierLevel,
      points: null,
      adp: null,
      rosterPct: null,
      sleeperSearchRank: null,
      sourceStatus: sourceStatus(rankOverall, tierLevel),
      rawJson: stableJson({ tier }),
    } satisfies RatingInput;
  });

  return {
    run: {
      source: "tiers",
      mode,
      season,
      week: null,
      scoring,
      position,
      fetchedAt,
      sourceLastUpdated,
      rowCount: integerOrNull(meta?.row_count) ?? ratings.length,
      expertSampleJson: meta?.experts ? stableJson(meta.experts) : null,
      metadataJson: meta ? stableJson(meta) : null,
      contentHash: runScopeHash("tiers", mode, position, scoring, ratings, meta),
    },
    ratings,
  };
}

function buildFantasyProsRatings(
  entries: CombinedEntryT[],
  position: PrimaryPositionShard,
  scoring: ScoringType,
  metadata: AggregateMetadata
): { run: SourceRunScope; ratings: RatingInput[] } {
  const meta = metadataFor(metadata, "fp", position, scoring);
  const season = extractSeason(meta);
  const mode = extractMode(meta, "draft");
  const week = extractWeek(meta);
  const fetchedAt = stringOrNull(meta?.fetched_at) ?? new Date().toISOString();
  const sourceLastUpdated = stringOrNull(meta?.last_updated);
  const { fpKey } = scoringKeys(scoring);

  const ratings = entries.map((entry) => {
    const rawRanking = entry.fantasypros?.rankings?.[fpKey];
    const ranking = isRecord(rawRanking) ? rawRanking : null;
    const rankOverall = numberOrNull(ranking?.rank_ecr);
    const rankPosition = parseFpPositionRank(entry.fantasypros?.pos_rank);
    const tier = numberOrNull(ranking?.tier);
    const points = fpStatsPoints(entry, scoring);
    const rosterPct = numberOrNull(entry.fantasypros?.player_owned_avg);
    return {
      playerId: entry.player_id,
      source: "fantasypros",
      mode,
      season,
      week,
      scoring,
      positionScope: position,
      rankOverall,
      rankPosition,
      tier,
      points,
      adp: null,
      rosterPct,
      sleeperSearchRank: null,
      sourceStatus: sourceStatus(rankOverall, rankPosition, tier, points, rosterPct),
      rawJson: stableJson({
        ranking,
        pos_rank: entry.fantasypros?.pos_rank ?? null,
        player_owned_avg: entry.fantasypros?.player_owned_avg ?? null,
      }),
    } satisfies RatingInput;
  });

  return {
    run: {
      source: "fantasypros",
      mode,
      season,
      week,
      scoring,
      position,
      fetchedAt,
      sourceLastUpdated,
      rowCount: integerOrNull(meta?.row_count) ?? ratings.length,
      expertSampleJson: meta?.experts ? stableJson(meta.experts) : null,
      metadataJson: meta ? stableJson(meta) : null,
      contentHash: runScopeHash(
        "fantasypros",
        mode,
        position,
        scoring,
        ratings,
        meta
      ),
    },
    ratings,
  };
}

function buildSleeperRatings(
  entries: CombinedEntryT[],
  position: PrimaryPositionShard,
  scoring: ScoringType
): { run: SourceRunScope; ratings: RatingInput[] } {
  const fetchedAt = new Date().toISOString();
  const sourceLastUpdated =
    entries
      .map((entry) => numberOrNull(entry.sleeper.updated_at))
      .filter((updatedAt): updatedAt is number => updatedAt != null)
      .sort((left, right) => right - left)[0] ?? null;
  const season = new Date().getFullYear();

  const ratings = entries.map((entry) => {
    const values = sleeperValues(entry, scoring);
    return {
      playerId: entry.player_id,
      source: "sleeper",
      mode: "projection",
      season,
      week: null,
      scoring,
      positionScope: position,
      rankOverall: null,
      rankPosition: null,
      tier: null,
      points: values.points,
      adp: values.adp,
      rosterPct: null,
      sleeperSearchRank: null,
      sourceStatus: sourceStatus(values.points, values.adp),
      rawJson: stableJson(values),
    } satisfies RatingInput;
  });

  return {
    run: {
      source: "sleeper",
      mode: "projection",
      season,
      week: null,
      scoring,
      position,
      fetchedAt,
      sourceLastUpdated: sourceLastUpdated
        ? new Date(sourceLastUpdated).toISOString()
        : null,
      rowCount: ratings.length,
      expertSampleJson: null,
      metadataJson: null,
      contentHash: runScopeHash(
        "sleeper",
        "projection",
        position,
        scoring,
        ratings,
        null
      ),
    },
    ratings,
  };
}

async function insertSourceRun(
  db: RatingHistoryDatabase,
  scope: SourceRunScope
) {
  const [run] = await db
    .insert(sourceRuns)
    .values({
      source: scope.source,
      mode: scope.mode,
      season: scope.season,
      week: scope.week,
      scoring: scope.scoring,
      position: scope.position,
      fetchedAt: scope.fetchedAt,
      sourceLastUpdated: scope.sourceLastUpdated,
      rowCount: scope.rowCount,
      expertSampleJson: scope.expertSampleJson,
      contentHash: scope.contentHash,
      metadataJson: scope.metadataJson,
      status: "success",
    })
    .returning();

  if (!run) throw new Error("Failed to insert source run");
  return run;
}

function ratingValueHash(rating: RatingInput) {
  return hashValue({
    rankOverall: rating.rankOverall,
    rankPosition: rating.rankPosition,
    tier: rating.tier,
    points: rating.points,
    adp: rating.adp,
    rosterPct: rating.rosterPct,
    sleeperSearchRank: rating.sleeperSearchRank,
    sourceStatus: rating.sourceStatus,
  });
}

async function findCurrentRating(
  db: RatingHistoryDatabase,
  identity: RatingIdentity
): Promise<PlayerRatingVersion | undefined> {
  const rows = await db
    .select()
    .from(playerRatingVersions)
    .where(
      and(
        eq(playerRatingVersions.playerId, identity.playerId),
        eq(playerRatingVersions.source, identity.source),
        eq(playerRatingVersions.mode, identity.mode),
        identity.season == null
          ? isNull(playerRatingVersions.season)
          : eq(playerRatingVersions.season, identity.season),
        identity.week == null
          ? isNull(playerRatingVersions.week)
          : eq(playerRatingVersions.week, identity.week),
        identity.scoring == null
          ? isNull(playerRatingVersions.scoring)
          : eq(playerRatingVersions.scoring, identity.scoring),
        identity.positionScope == null
          ? isNull(playerRatingVersions.positionScope)
          : eq(playerRatingVersions.positionScope, identity.positionScope),
        eq(playerRatingVersions.isCurrent, true)
      )
    )
    .orderBy(desc(playerRatingVersions.id))
    .limit(1);

  return rows[0];
}

async function upsertPlayer(db: RatingHistoryDatabase, entry: CombinedEntryT) {
  await db
    .insert(historyPlayers)
    .values({
      playerId: entry.player_id,
      name: entry.name,
      position: entry.position,
      team: entry.team,
      byeWeek: entry.bye_week,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: historyPlayers.playerId,
      set: {
        name: entry.name,
        position: entry.position,
        team: entry.team,
        byeWeek: entry.bye_week,
        updatedAt: new Date().toISOString(),
      },
    });
}

async function upsertRatingVersion(
  db: RatingHistoryDatabase,
  rating: RatingInput,
  sourceRunId: number,
  effectiveFrom: string
): Promise<"inserted" | "unchanged" | "closed-and-inserted"> {
  const valueHash = ratingValueHash(rating);
  const current = await findCurrentRating(db, rating);
  if (current?.valueHash === valueHash) return "unchanged";

  if (current) {
    await db
      .update(playerRatingVersions)
      .set({ isCurrent: false, effectiveTo: effectiveFrom })
      .where(eq(playerRatingVersions.id, current.id));
  }

  await db.insert(playerRatingVersions).values({
    ...rating,
    sourceRunId,
    effectiveFrom,
    effectiveTo: null,
    isCurrent: true,
    valueHash,
  });

  return current ? "closed-and-inserted" : "inserted";
}

async function ingestScope(
  db: RatingHistoryDatabase,
  scope: { run: SourceRunScope; ratings: RatingInput[] },
  effectiveFrom: string
): Promise<Omit<IngestStats, "playerUpserts">> {
  const run = await insertSourceRun(db, scope.run);
  const stats = {
    sourceRuns: 1,
    ratingVersionsInserted: 0,
    ratingVersionsUnchanged: 0,
    ratingVersionsClosed: 0,
  };

  for (const rating of scope.ratings) {
    const result = await upsertRatingVersion(db, rating, run.id, effectiveFrom);
    if (result === "unchanged") {
      stats.ratingVersionsUnchanged += 1;
    } else if (result === "inserted") {
      stats.ratingVersionsInserted += 1;
    } else {
      stats.ratingVersionsClosed += 1;
      stats.ratingVersionsInserted += 1;
    }
  }

  return stats;
}

function addStats(left: IngestStats, right: Partial<IngestStats>) {
  left.sourceRuns += right.sourceRuns ?? 0;
  left.playerUpserts += right.playerUpserts ?? 0;
  left.ratingVersionsInserted += right.ratingVersionsInserted ?? 0;
  left.ratingVersionsUnchanged += right.ratingVersionsUnchanged ?? 0;
  left.ratingVersionsClosed += right.ratingVersionsClosed ?? 0;
}

export async function ingestAggregateHistory(
  db: RatingHistoryDatabase,
  input: {
    shards: AggregateShards;
    metadata?: AggregateMetadata;
    effectiveFrom?: string;
  }
): Promise<IngestStats> {
  const effectiveFrom = input.effectiveFrom ?? new Date().toISOString();
  const metadata = input.metadata ?? {};
  const stats: IngestStats = {
    sourceRuns: 0,
    playerUpserts: 0,
    ratingVersionsInserted: 0,
    ratingVersionsUnchanged: 0,
    ratingVersionsClosed: 0,
  };

  const uniquePrimaryEntries = new Map<string, CombinedEntryT>();
  for (const position of PRIMARY_POSITION_SHARDS) {
    for (const entry of Object.values(input.shards[position] ?? {})) {
      uniquePrimaryEntries.set(entry.player_id, entry);
    }
  }
  for (const entry of uniquePrimaryEntries.values()) {
    await upsertPlayer(db, entry);
    stats.playerUpserts += 1;
  }

  for (const scoring of SCORINGS) {
    for (const position of SHARDS) {
      const entries = Object.values(input.shards[position] ?? {});
      if (!entries.length) continue;
      addStats(
        stats,
        await ingestScope(
          db,
          buildTiersRatings(entries, position, scoring, metadata),
          effectiveFrom
        )
      );
    }

    for (const position of PRIMARY_POSITION_SHARDS) {
      const entries = Object.values(input.shards[position] ?? {});
      if (!entries.length) continue;
      addStats(
        stats,
        await ingestScope(
          db,
          buildFantasyProsRatings(entries, position, scoring, metadata),
          effectiveFrom
        )
      );
      addStats(
        stats,
        await ingestScope(
          db,
          buildSleeperRatings(entries, position, scoring),
          effectiveFrom
        )
      );
    }
  }

  return stats;
}
