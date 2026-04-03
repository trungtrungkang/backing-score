CREATE TABLE `drive_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original_name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`content_type` text NOT NULL,
	`r2_key` text NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sheet_nav_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`sheet_music_id` text NOT NULL,
	`user_id` text NOT NULL,
	`bookmarks` text NOT NULL,
	`sequence` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sheet_music_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `project_type` text(20) DEFAULT 'backing_track' NOT NULL;