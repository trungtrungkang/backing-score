CREATE TABLE `live_attendances` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`student_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `live_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`classroom_id` text NOT NULL,
	`host_id` text NOT NULL,
	`active_project_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `notifications` ADD `source_user_id` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `source_user_name` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `target_type` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `target_name` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `target_id` text;