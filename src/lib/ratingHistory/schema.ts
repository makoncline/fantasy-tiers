import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const historyPlayers = sqliteTable(
  "history_players",
  {
    playerId: text("player_id").primaryKey(),
    name: text("name").notNull(),
    position: text("position"),
    team: text("team"),
    byeWeek: integer("bye_week"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("history_players_position_idx").on(table.position),
    index("history_players_team_idx").on(table.team),
  ]
);

export const sourceRuns = sqliteTable(
  "source_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(),
    mode: text("mode").notNull(),
    season: integer("season"),
    week: integer("week"),
    scoring: text("scoring"),
    position: text("position"),
    fetchedAt: text("fetched_at").notNull(),
    sourceLastUpdated: text("source_last_updated"),
    rowCount: integer("row_count"),
    expertSampleJson: text("expert_sample_json"),
    contentHash: text("content_hash").notNull(),
    metadataJson: text("metadata_json"),
    status: text("status").notNull().default("success"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("source_runs_source_idx").on(table.source, table.mode),
    index("source_runs_scope_idx").on(
      table.source,
      table.mode,
      table.season,
      table.week,
      table.scoring,
      table.position
    ),
    index("source_runs_fetched_at_idx").on(table.fetchedAt),
  ]
);

export const playerRatingVersions = sqliteTable(
  "player_rating_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: text("player_id")
      .notNull()
      .references(() => historyPlayers.playerId, { onDelete: "cascade" }),
    sourceRunId: integer("source_run_id")
      .notNull()
      .references(() => sourceRuns.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    mode: text("mode").notNull(),
    season: integer("season"),
    week: integer("week"),
    scoring: text("scoring"),
    positionScope: text("position_scope"),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    isCurrent: integer("is_current", { mode: "boolean" })
      .notNull()
      .default(true),
    rankOverall: real("rank_overall"),
    rankPosition: real("rank_position"),
    tier: real("tier"),
    points: real("points"),
    adp: real("adp"),
    rosterPct: real("roster_pct"),
    sleeperSearchRank: integer("sleeper_search_rank"),
    sourceStatus: text("source_status").notNull().default("present"),
    valueHash: text("value_hash").notNull(),
    rawJson: text("raw_json"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("player_rating_versions_player_idx").on(table.playerId),
    index("player_rating_versions_current_idx").on(
      table.playerId,
      table.source,
      table.mode,
      table.season,
      table.week,
      table.scoring,
      table.positionScope,
      table.isCurrent
    ),
    index("player_rating_versions_scope_idx").on(
      table.source,
      table.mode,
      table.season,
      table.week,
      table.scoring,
      table.positionScope
    ),
    index("player_rating_versions_dashboard_scope_idx").on(
      table.isCurrent,
      table.playerId,
      table.source,
      table.mode,
      table.season,
      table.week,
      table.scoring,
      table.positionScope
    ),
    index("player_rating_versions_dashboard_coverage_idx").on(
      table.isCurrent,
      table.source,
      table.mode,
      table.scoring,
      table.positionScope,
      table.sourceStatus,
      table.effectiveFrom
    ),
    index("player_rating_versions_dashboard_absent_idx").on(
      table.isCurrent,
      table.sourceStatus,
      table.effectiveFrom
    ),
    index("player_rating_versions_prior_lookup_idx").on(
      table.playerId,
      table.source,
      table.mode,
      table.season,
      table.week,
      table.scoring,
      table.positionScope,
      table.sourceStatus,
      table.effectiveFrom
    ),
  ]
);

export const ratingHistorySchema = {
  historyPlayers,
  sourceRuns,
  playerRatingVersions,
};

export type HistoryPlayer = typeof historyPlayers.$inferSelect;
export type NewHistoryPlayer = typeof historyPlayers.$inferInsert;
export type SourceRun = typeof sourceRuns.$inferSelect;
export type NewSourceRun = typeof sourceRuns.$inferInsert;
export type PlayerRatingVersion = typeof playerRatingVersions.$inferSelect;
export type NewPlayerRatingVersion = typeof playerRatingVersions.$inferInsert;
