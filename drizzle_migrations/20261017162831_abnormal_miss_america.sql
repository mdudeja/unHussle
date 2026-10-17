ALTER TABLE `areas` ADD `area_tag` text;--> statement-breakpoint
CREATE UNIQUE INDEX `areas_area_tag_unique` ON `areas` (`area_tag`);--> statement-breakpoint
ALTER TABLE `goals` ADD `goal_tag` text;--> statement-breakpoint
CREATE UNIQUE INDEX `goals_goal_tag_unique` ON `goals` (`goal_tag`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_project_tag_unique` ON `projects` (`project_tag`);