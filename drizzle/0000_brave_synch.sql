CREATE TABLE `history_players` (
	`player_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` text,
	`team` text,
	`bye_week` integer,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `history_players_position_idx` ON `history_players` (`position`);--> statement-breakpoint
CREATE INDEX `history_players_team_idx` ON `history_players` (`team`);--> statement-breakpoint
CREATE TABLE `player_rating_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`source_run_id` integer NOT NULL,
	`source` text NOT NULL,
	`mode` text NOT NULL,
	`season` integer,
	`week` integer,
	`scoring` text,
	`position_scope` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`is_current` integer DEFAULT true NOT NULL,
	`rank_overall` real,
	`rank_position` real,
	`tier` real,
	`points` real,
	`adp` real,
	`roster_pct` real,
	`sleeper_search_rank` integer,
	`source_status` text DEFAULT 'present' NOT NULL,
	`value_hash` text NOT NULL,
	`raw_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `history_players`(`player_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_run_id`) REFERENCES `source_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_rating_versions_player_idx` ON `player_rating_versions` (`player_id`);--> statement-breakpoint
CREATE INDEX `player_rating_versions_current_idx` ON `player_rating_versions` (`player_id`,`source`,`mode`,`season`,`week`,`scoring`,`position_scope`,`is_current`);--> statement-breakpoint
CREATE INDEX `player_rating_versions_scope_idx` ON `player_rating_versions` (`source`,`mode`,`season`,`week`,`scoring`,`position_scope`);--> statement-breakpoint
CREATE TABLE `source_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`mode` text NOT NULL,
	`season` integer,
	`week` integer,
	`scoring` text,
	`position` text,
	`fetched_at` text NOT NULL,
	`source_last_updated` text,
	`row_count` integer,
	`expert_sample_json` text,
	`content_hash` text NOT NULL,
	`metadata_json` text,
	`status` text DEFAULT 'success' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `source_runs_source_idx` ON `source_runs` (`source`,`mode`);--> statement-breakpoint
CREATE INDEX `source_runs_scope_idx` ON `source_runs` (`source`,`mode`,`season`,`week`,`scoring`,`position`);--> statement-breakpoint
CREATE INDEX `source_runs_fetched_at_idx` ON `source_runs` (`fetched_at`);