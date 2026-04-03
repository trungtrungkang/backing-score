CREATE TABLE `platform_config` (
	`key` text(50) PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration_ms` integer NOT NULL,
	`max_speed` real,
	`wait_mode_score` integer,
	`flow_mode_score` integer,
	`input_type` text(10),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_stats` (
	`user_id` text PRIMARY KEY NOT NULL,
	`total_xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_practice_date` text(10),
	`total_practice_ms` integer DEFAULT 0 NOT NULL,
	`badges` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text(32) NOT NULL,
	`target_id` text NOT NULL,
	`source_product_id` text NOT NULL,
	`granted_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`target_type` text(32) NOT NULL,
	`target_id` text NOT NULL,
	`price_cents` integer NOT NULL,
	`lemon_squeezy_variant_id` text(64) NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`order_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text(16) NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text(32) NOT NULL,
	`plan_id` text NOT NULL,
	`current_period_end` integer NOT NULL,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_wiki_composers` (
	`project_id` text NOT NULL,
	`artist_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `wiki_artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_wiki_instruments` (
	`project_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `wiki_instruments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wiki_artists` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_original` text,
	`bio` text(16384),
	`birth_date` text(32),
	`death_date` text(32),
	`nationality` text(128),
	`roles` text,
	`image_url` text(2048),
	`cover_url` text(2048)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_artists_slug_unique` ON `wiki_artists` (`slug`);--> statement-breakpoint
CREATE TABLE `wiki_compositions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`period` text(128),
	`genre_id` text,
	`key_signature` text(32),
	`description` text(4096),
	FOREIGN KEY (`genre_id`) REFERENCES `wiki_genres`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_compositions_slug_unique` ON `wiki_compositions` (`slug`);--> statement-breakpoint
CREATE TABLE `wiki_genres` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text(4096),
	`parent_genre_id` text,
	`era` text(128),
	FOREIGN KEY (`parent_genre_id`) REFERENCES `wiki_genres`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_genres_slug_unique` ON `wiki_genres` (`slug`);--> statement-breakpoint
CREATE TABLE `wiki_instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`family` text(128),
	`description` text(4096),
	`image_url` text(2048),
	`tuning` text(256)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_instruments_slug_unique` ON `wiki_instruments` (`slug`);--> statement-breakpoint
CREATE TABLE `wiki_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`locale` text(10) NOT NULL,
	`field` text(64) NOT NULL,
	`value` text(16384) NOT NULL
);
