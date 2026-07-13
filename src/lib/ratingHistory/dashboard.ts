import { sql } from "drizzle-orm";
import { z } from "zod";
import type { RatingHistoryDatabase } from "./db";

const Count = z.coerce.number().int().nonnegative();
const NullableText = z.string().nullable();
const NullableNumber = z.coerce.number().nullable();
const SqlBoolean = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .transform((value) => value === true || value === 1);

const TotalsRow = z.object({
  totalPlayers: Count,
  totalSourceRuns: Count,
  totalRatingVersions: Count,
  currentRatingVersions: Count,
  closedRatingVersions: Count,
  changedRatingScopes: Count,
  currentAbsentRatings: Count,
  latestFetchedAt: NullableText,
  latestEffectiveFrom: NullableText,
});

const LatestSourceRunRow = z.object({
  id: Count,
  source: z.string(),
  mode: z.string(),
  season: NullableNumber,
  week: NullableNumber,
  scoring: NullableText,
  position: NullableText,
  fetchedAt: z.string(),
  sourceLastUpdated: NullableText,
  rowCount: NullableNumber,
  contentHash: z.string(),
  status: z.string(),
});

const CoverageRow = z.object({
  source: z.string(),
  mode: z.string(),
  scoring: NullableText,
  positionScope: NullableText,
  currentCount: Count,
  presentCount: Count,
  absentCount: Count,
  latestEffectiveFrom: z.string(),
});

const MissingWithPriorRow = z.object({
  id: Count,
  playerId: z.string(),
  name: z.string(),
  position: NullableText,
  team: NullableText,
  byeWeek: NullableNumber,
  source: z.string(),
  mode: z.string(),
  scoring: NullableText,
  positionScope: NullableText,
  effectiveFrom: z.string(),
  lastPresentAt: z.string(),
  lastRankOverall: NullableNumber,
  lastRankPosition: NullableNumber,
  lastTier: NullableNumber,
  lastPoints: NullableNumber,
  lastAdp: NullableNumber,
});

const PlayerSearchRow = z.object({
  playerId: z.string(),
  name: z.string(),
  position: NullableText,
  team: NullableText,
  byeWeek: NullableNumber,
  currentScopes: Count,
  currentAbsentRatings: Count,
  latestEffectiveFrom: NullableText,
});

const PlayerTimelineRow = z.object({
  id: Count,
  sourceRunId: Count,
  source: z.string(),
  mode: z.string(),
  season: NullableNumber,
  week: NullableNumber,
  scoring: NullableText,
  positionScope: NullableText,
  effectiveFrom: z.string(),
  effectiveTo: NullableText,
  isCurrent: SqlBoolean,
  rankOverall: NullableNumber,
  rankPosition: NullableNumber,
  tier: NullableNumber,
  points: NullableNumber,
  adp: NullableNumber,
  rosterPct: NullableNumber,
  sleeperSearchRank: NullableNumber,
  sourceStatus: z.string(),
  valueHash: z.string(),
});

export type RatingHistoryDashboard = {
  totals: z.infer<typeof TotalsRow>;
  latestSourceRuns: Array<z.infer<typeof LatestSourceRunRow>>;
  coverage: Array<z.infer<typeof CoverageRow>>;
  missingWithPrior: Array<z.infer<typeof MissingWithPriorRow>>;
};

export type PlayerRatingHistory = {
  query: string;
  searchResults: Array<z.infer<typeof PlayerSearchRow>>;
  selectedPlayer: z.infer<typeof PlayerSearchRow> | null;
  timeline: Array<z.infer<typeof PlayerTimelineRow>>;
};

export async function getRatingHistoryDashboard(
  db: RatingHistoryDatabase
): Promise<RatingHistoryDashboard> {
  const [totalRows, latestSourceRunRows, coverageRows, missingWithPriorRows] =
    await Promise.all([
      db.all(sql`
        SELECT
          (SELECT COUNT(*) FROM history_players) AS totalPlayers,
          (SELECT COUNT(*) FROM source_runs) AS totalSourceRuns,
          (SELECT COUNT(*) FROM player_rating_versions) AS totalRatingVersions,
          (
            SELECT COUNT(*)
            FROM player_rating_versions
            WHERE is_current = 1
          ) AS currentRatingVersions,
          (
            SELECT COUNT(*)
            FROM player_rating_versions
            WHERE is_current = 0
          ) AS closedRatingVersions,
          (
            SELECT COUNT(*)
            FROM (
              SELECT
                player_id,
                source,
                mode,
                season,
                week,
                scoring,
                position_scope
              FROM player_rating_versions
              GROUP BY
                player_id,
                source,
                mode,
                season,
                week,
                scoring,
                position_scope
              HAVING COUNT(*) > 1
            )
          ) AS changedRatingScopes,
          (
            SELECT COUNT(*)
            FROM player_rating_versions
            WHERE is_current = 1
              AND source_status = 'absent'
          ) AS currentAbsentRatings,
          (SELECT MAX(fetched_at) FROM source_runs) AS latestFetchedAt,
          (
            SELECT MAX(effective_from)
            FROM player_rating_versions
          ) AS latestEffectiveFrom
      `),
      db.all(sql`
        SELECT
          id,
          source,
          mode,
          season,
          week,
          scoring,
          position,
          fetched_at AS fetchedAt,
          source_last_updated AS sourceLastUpdated,
          row_count AS rowCount,
          content_hash AS contentHash,
          status
        FROM source_runs
        ORDER BY id DESC
        LIMIT 60
      `),
      db.all(sql`
        SELECT
          source,
          mode,
          scoring,
          position_scope AS positionScope,
          COUNT(*) AS currentCount,
          SUM(CASE WHEN source_status = 'present' THEN 1 ELSE 0 END)
            AS presentCount,
          SUM(CASE WHEN source_status = 'absent' THEN 1 ELSE 0 END)
            AS absentCount,
          MAX(effective_from) AS latestEffectiveFrom
        FROM player_rating_versions
        WHERE is_current = 1
        GROUP BY source, mode, scoring, position_scope
        ORDER BY
          source,
          mode,
          CASE scoring
            WHEN 'std' THEN 1
            WHEN 'half' THEN 2
            WHEN 'ppr' THEN 3
            ELSE 4
          END,
          position_scope
      `),
      db.all(sql`
        SELECT
          current.id,
          current.player_id AS playerId,
          players.name,
          players.position,
          players.team,
          players.bye_week AS byeWeek,
          current.source,
          current.mode,
          current.scoring,
          current.position_scope AS positionScope,
          current.effective_from AS effectiveFrom,
          prior.effective_from AS lastPresentAt,
          prior.rank_overall AS lastRankOverall,
          prior.rank_position AS lastRankPosition,
          prior.tier AS lastTier,
          prior.points AS lastPoints,
          prior.adp AS lastAdp
        FROM player_rating_versions current
        JOIN history_players players
          ON players.player_id = current.player_id
        JOIN player_rating_versions prior
          ON prior.id = (
            SELECT candidate.id
            FROM player_rating_versions candidate
            WHERE candidate.player_id = current.player_id
              AND candidate.source = current.source
              AND candidate.mode = current.mode
              AND candidate.season IS current.season
              AND candidate.week IS current.week
              AND candidate.scoring IS current.scoring
              AND candidate.position_scope IS current.position_scope
              AND candidate.source_status = 'present'
              AND candidate.id <> current.id
            ORDER BY candidate.effective_from DESC, candidate.id DESC
            LIMIT 1
          )
        WHERE current.is_current = 1
          AND current.source_status = 'absent'
        ORDER BY current.effective_from DESC, players.position, players.name
        LIMIT 100
      `),
    ]);

  return {
    totals: TotalsRow.parse(totalRows[0]),
    latestSourceRuns: LatestSourceRunRow.array().parse(latestSourceRunRows),
    coverage: CoverageRow.array().parse(coverageRows),
    missingWithPrior: MissingWithPriorRow.array().parse(missingWithPriorRows),
  };
}

async function searchPlayers(
  db: RatingHistoryDatabase,
  query: string,
  limit: number
) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const pattern = `%${trimmed.toLowerCase()}%`;
  const prefixPattern = `${trimmed.toLowerCase()}%`;
  const wordPattern = `% ${trimmed.toLowerCase()}%`;

  const rows = await db.all(sql`
    SELECT
      players.player_id AS playerId,
      players.name,
      players.position,
      players.team,
      players.bye_week AS byeWeek,
      COUNT(current.id) AS currentScopes,
      SUM(CASE WHEN current.source_status = 'absent' THEN 1 ELSE 0 END)
        AS currentAbsentRatings,
      MAX(current.effective_from) AS latestEffectiveFrom
    FROM history_players players
    LEFT JOIN player_rating_versions current
      ON current.player_id = players.player_id
      AND current.is_current = 1
    WHERE LOWER(players.name) LIKE ${pattern}
      OR LOWER(players.player_id) LIKE ${pattern}
      OR LOWER(COALESCE(players.team, '')) LIKE ${pattern}
    GROUP BY
      players.player_id,
      players.name,
      players.position,
      players.team,
      players.bye_week
    ORDER BY
      CASE
        WHEN LOWER(players.name) = ${trimmed.toLowerCase()} THEN 0
        WHEN LOWER(players.name) LIKE ${prefixPattern} THEN 1
        WHEN LOWER(players.name) LIKE ${wordPattern} THEN 1
        ELSE 2
      END,
      CASE WHEN COALESCE(players.team, '') IN ('', 'FA') THEN 1 ELSE 0 END,
      (
        COUNT(current.id) -
        SUM(CASE WHEN current.source_status = 'absent' THEN 1 ELSE 0 END)
      ) DESC,
      SUM(CASE WHEN current.source_status = 'absent' THEN 1 ELSE 0 END),
      CASE players.position
        WHEN 'RB' THEN 0
        WHEN 'WR' THEN 1
        WHEN 'TE' THEN 2
        WHEN 'QB' THEN 3
        WHEN 'K' THEN 4
        WHEN 'DEF' THEN 5
        ELSE 6
      END,
      players.name
    LIMIT ${limit}
  `);

  return PlayerSearchRow.array().parse(rows);
}

async function getPlayerSummary(
  db: RatingHistoryDatabase,
  playerId: string
) {
  const rows = await db.all(sql`
    SELECT
      players.player_id AS playerId,
      players.name,
      players.position,
      players.team,
      players.bye_week AS byeWeek,
      COUNT(current.id) AS currentScopes,
      SUM(CASE WHEN current.source_status = 'absent' THEN 1 ELSE 0 END)
        AS currentAbsentRatings,
      MAX(current.effective_from) AS latestEffectiveFrom
    FROM history_players players
    LEFT JOIN player_rating_versions current
      ON current.player_id = players.player_id
      AND current.is_current = 1
    WHERE players.player_id = ${playerId}
    GROUP BY
      players.player_id,
      players.name,
      players.position,
      players.team,
      players.bye_week
    LIMIT 1
  `);

  return rows[0] ? PlayerSearchRow.parse(rows[0]) : null;
}

async function getPlayerTimeline(
  db: RatingHistoryDatabase,
  playerId: string
) {
  const rows = await db.all(sql`
    SELECT
      id,
      source_run_id AS sourceRunId,
      source,
      mode,
      season,
      week,
      scoring,
      position_scope AS positionScope,
      effective_from AS effectiveFrom,
      effective_to AS effectiveTo,
      is_current AS isCurrent,
      rank_overall AS rankOverall,
      rank_position AS rankPosition,
      tier,
      points,
      adp,
      roster_pct AS rosterPct,
      sleeper_search_rank AS sleeperSearchRank,
      source_status AS sourceStatus,
      value_hash AS valueHash
    FROM player_rating_versions
    WHERE player_id = ${playerId}
    ORDER BY effective_from DESC, id DESC
    LIMIT 2000
  `);

  return PlayerTimelineRow.array().parse(rows);
}

export async function getPlayerRatingHistory(
  db: RatingHistoryDatabase,
  input: {
    query?: string;
    playerId?: string;
    searchLimit?: number;
  }
): Promise<PlayerRatingHistory> {
  const query = input.query?.trim() ?? "";
  const searchLimit = Math.min(Math.max(input.searchLimit ?? 25, 1), 50);
  const searchResults = await searchPlayers(db, query, searchLimit);
  const selectedPlayerId = input.playerId ?? searchResults[0]?.playerId;
  const selectedPlayer = selectedPlayerId
    ? await getPlayerSummary(db, selectedPlayerId)
    : null;
  const timeline = selectedPlayer
    ? await getPlayerTimeline(db, selectedPlayer.playerId)
    : [];

  return {
    query,
    searchResults,
    selectedPlayer,
    timeline,
  };
}
