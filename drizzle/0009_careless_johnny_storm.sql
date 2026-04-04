CREATE TABLE `project_wiki_genres` (
	`project_id` text NOT NULL,
	`genre_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `wiki_genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`status` text(20) DEFAULT 'in_progress' NOT NULL,
	`wait_mode_score` integer DEFAULT 0 NOT NULL,
	`completed_snippets` text DEFAULT '[]' NOT NULL,
	`unlocked` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_progress`("id", "user_id", "course_id", "lesson_id", "status", "wait_mode_score", "completed_snippets", "unlocked", "completed_at", "updated_at") SELECT "id", "user_id", "course_id", "lesson_id", "status", "wait_mode_score", "completed_snippets", "unlocked", "completed_at", "updated_at" FROM `progress`;--> statement-breakpoint
DROP TABLE `progress`;--> statement-breakpoint
ALTER TABLE `__new_progress` RENAME TO `progress`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `courses` ADD `creator_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `courses` ADD `category` text(50);--> statement-breakpoint
ALTER TABLE `courses` ADD `course_code` text(20);--> statement-breakpoint
ALTER TABLE `courses` ADD `published` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `visibility` text(20) DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `content_raw` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `published` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `plan_name` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `product_id` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `order_id` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `customer_id` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `user_email` text;