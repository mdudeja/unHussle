CREATE TABLE `progress_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`goal_id` text,
	`task_id` text,
	`occurrence_id` text,
	`minutes` integer DEFAULT 0 NOT NULL,
	`amount` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`occurrence_id`) REFERENCES `task_occurrences`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "progress_sessions_one_item" CHECK(("progress_sessions"."project_id" IS NULL) <> ("progress_sessions"."goal_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `progress_sessions_project_idx` ON `progress_sessions` (`project_id`);--> statement-breakpoint
CREATE INDEX `progress_sessions_goal_idx` ON `progress_sessions` (`goal_id`);--> statement-breakpoint
CREATE INDEX `progress_sessions_task_idx` ON `progress_sessions` (`task_id`);--> statement-breakpoint
CREATE INDEX `progress_sessions_created_at_idx` ON `progress_sessions` (`created_at`);--> statement-breakpoint
ALTER TABLE `goals` ADD `progress_done` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `goals` ADD `progress_total` integer;--> statement-breakpoint
ALTER TABLE `goals` ADD `progress_unit` text;--> statement-breakpoint
ALTER TABLE `goals` ADD `progress_input` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `progress_done` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `progress_total` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `progress_unit` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `progress_input` text;