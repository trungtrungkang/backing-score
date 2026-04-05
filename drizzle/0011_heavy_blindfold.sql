CREATE TABLE `sheet_overlays` (
	`id` text PRIMARY KEY NOT NULL,
	`sheet_music_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text DEFAULT 'My Notes' NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`bookmarks` text NOT NULL,
	`sequence` text NOT NULL,
	`annotations` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sheet_music_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `sheet_nav_maps`;