import { sql } from "drizzle-orm";
import type { RatingHistoryDatabase } from "./db";

export async function migrateRatingHistoryDb(db: RatingHistoryDatabase) {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS history_players (
      player_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      position TEXT,
      team TEXT,
      bye_week INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS history_players_position_idx
    ON history_players (position)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS history_players_team_idx
    ON history_players (team)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS source_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      mode TEXT NOT NULL,
      season INTEGER,
      week INTEGER,
      scoring TEXT,
      position TEXT,
      fetched_at TEXT NOT NULL,
      source_last_updated TEXT,
      row_count INTEGER,
      expert_sample_json TEXT,
      content_hash TEXT NOT NULL,
      metadata_json TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS source_runs_source_idx
    ON source_runs (source, mode)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS source_runs_scope_idx
    ON source_runs (source, mode, season, week, scoring, position)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS source_runs_fetched_at_idx
    ON source_runs (fetched_at)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS player_rating_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL REFERENCES history_players(player_id) ON DELETE CASCADE,
      source_run_id INTEGER NOT NULL REFERENCES source_runs(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      mode TEXT NOT NULL,
      season INTEGER,
      week INTEGER,
      scoring TEXT,
      position_scope TEXT,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      is_current INTEGER NOT NULL DEFAULT 1,
      rank_overall REAL,
      rank_position REAL,
      tier REAL,
      points REAL,
      adp REAL,
      roster_pct REAL,
      sleeper_search_rank INTEGER,
      source_status TEXT NOT NULL DEFAULT 'present',
      value_hash TEXT NOT NULL,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS player_rating_versions_player_idx
    ON player_rating_versions (player_id)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS player_rating_versions_current_idx
    ON player_rating_versions (
      player_id,
      source,
      mode,
      season,
      week,
      scoring,
      position_scope,
      is_current
    )
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS player_rating_versions_scope_idx
    ON player_rating_versions (
      source,
      mode,
      season,
      week,
      scoring,
      position_scope
    )
  `);
}
