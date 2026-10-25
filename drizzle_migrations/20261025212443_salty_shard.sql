ALTER TABLE `tasks` RENAME COLUMN "scheduled_for" TO "scheduled_start";--> statement-breakpoint
DROP INDEX `tasks_scheduled_for_idx`;--> statement-breakpoint
ALTER TABLE `tasks` ADD `anchor_type` text DEFAULT 'any_after';--> statement-breakpoint
ALTER TABLE `tasks` ADD `scheduled_end` integer;--> statement-breakpoint
CREATE INDEX `tasks_scheduled_start_idx` ON `tasks` (`scheduled_start`);--> statement-breakpoint
CREATE INDEX `tasks_scheduled_end_idx` ON `tasks` (`scheduled_end`);