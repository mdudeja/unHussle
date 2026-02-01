CREATE TABLE `areas` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'planned',
	`priority` text DEFAULT 'medium',
	`icon` text,
	`color` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `areas_title_idx` ON `areas` (`title`);--> statement-breakpoint
CREATE INDEX `areas_status_idx` ON `areas` (`status`);--> statement-breakpoint
CREATE INDEX `areas_priority_idx` ON `areas` (`priority`);--> statement-breakpoint
CREATE INDEX `areas_created_at_idx` ON `areas` (`created_at`);--> statement-breakpoint
CREATE INDEX `areas_updated_at_idx` ON `areas` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `areas_title_unique` ON `areas` (`title`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'planned',
	`priority` text DEFAULT 'medium',
	`icon` text,
	`color` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`area_id` text,
	`due_date` integer,
	`progress` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `goals_title_idx` ON `goals` (`title`);--> statement-breakpoint
CREATE INDEX `goals_due_date_idx` ON `goals` (`due_date`);--> statement-breakpoint
CREATE INDEX `goals_status_idx` ON `goals` (`status`);--> statement-breakpoint
CREATE INDEX `goals_priority_idx` ON `goals` (`priority`);--> statement-breakpoint
CREATE INDEX `goals_created_at_idx` ON `goals` (`created_at`);--> statement-breakpoint
CREATE INDEX `goals_updated_at_idx` ON `goals` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `goals_title_unique` ON `goals` (`title`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`project_id` text,
	`area_id` text,
	`goal_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`status` text DEFAULT 'planned',
	`priority` text DEFAULT 'medium',
	`estimated_minutes` integer,
	`spent_minutes` integer DEFAULT 0 NOT NULL,
	`due_date` integer,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurring_rule` text,
	`is_fun` integer DEFAULT false NOT NULL,
	`is_chore` integer DEFAULT false NOT NULL,
	`is_quick` integer DEFAULT false NOT NULL,
	`stack_order` integer DEFAULT 0 NOT NULL,
	`scheduled_for` integer,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_project_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_area_idx` ON `tasks` (`area_id`);--> statement-breakpoint
CREATE INDEX `tasks_goal_idx` ON `tasks` (`goal_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_due_date_idx` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_scheduled_for_idx` ON `tasks` (`scheduled_for`);--> statement-breakpoint
CREATE INDEX `tasks_title_idx` ON `tasks` (`title`);--> statement-breakpoint
CREATE INDEX `tasks_created_at_idx` ON `tasks` (`created_at`);--> statement-breakpoint
CREATE INDEX `tasks_updated_at_idx` ON `tasks` (`updated_at`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`project_id` text,
	`area_id` text,
	`goal_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `resources_project_idx` ON `resources` (`project_id`);--> statement-breakpoint
CREATE INDEX `resources_area_idx` ON `resources` (`area_id`);--> statement-breakpoint
CREATE INDEX `resources_goal_idx` ON `resources` (`goal_id`);--> statement-breakpoint
CREATE INDEX `resources_title_idx` ON `resources` (`title`);--> statement-breakpoint
CREATE INDEX `resources_created_at_idx` ON `resources` (`created_at`);--> statement-breakpoint
CREATE INDEX `resources_updated_at_idx` ON `resources` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `resources_title_unique` ON `resources` (`title`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'planned',
	`priority` text DEFAULT 'medium',
	`icon` text,
	`color` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`area_id` text,
	`goal_id` text,
	`due_date` integer,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `projects_title_idx` ON `projects` (`title`);--> statement-breakpoint
CREATE INDEX `projects_area_idx` ON `projects` (`area_id`);--> statement-breakpoint
CREATE INDEX `projects_goal_idx` ON `projects` (`goal_id`);--> statement-breakpoint
CREATE INDEX `projects_due_date_idx` ON `projects` (`due_date`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `projects_priority_idx` ON `projects` (`priority`);--> statement-breakpoint
CREATE INDEX `projects_created_at_idx` ON `projects` (`created_at`);--> statement-breakpoint
CREATE INDEX `projects_updated_at_idx` ON `projects` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_title_unique` ON `projects` (`title`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`title` text NOT NULL,
	`color` text
);
--> statement-breakpoint
CREATE INDEX `tags_title_idx` ON `tags` (`title`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_title_unique` ON `tags` (`title`);--> statement-breakpoint
CREATE TABLE `urls` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`title` text,
	`url` text NOT NULL,
	`parts` text DEFAULT '{"protocol":"","hostname":"","pathname":""}'
);
--> statement-breakpoint
CREATE INDEX `urls_title_idx` ON `urls` (`title`);--> statement-breakpoint
CREATE INDEX `urls_url_idx` ON `urls` (`url`);--> statement-breakpoint
CREATE INDEX `urls_parts_idx` ON `urls` (`parts`);--> statement-breakpoint
CREATE UNIQUE INDEX `urls_url_unique` ON `urls` (`url`);--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`task_id` text,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`duration` integer DEFAULT 0,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `time_entries_task_idx` ON `time_entries` (`task_id`);--> statement-breakpoint
CREATE TABLE `junction_tags` (
	`attachedToId` text NOT NULL,
	`refId` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`attachedToId`, `refId`),
	FOREIGN KEY (`refId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `junction_tags_attachedToId_refId_idx` ON `junction_tags` (`attachedToId`,`refId`);--> statement-breakpoint
CREATE UNIQUE INDEX `junction_tags_attachedToId_refId_unique` ON `junction_tags` (`attachedToId`,`refId`);--> statement-breakpoint
CREATE TABLE `junction_urls` (
	`attachedToId` text NOT NULL,
	`refId` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`attachedToId`, `refId`),
	FOREIGN KEY (`refId`) REFERENCES `urls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `junction_urls_attachedToId_refId_idx` ON `junction_urls` (`attachedToId`,`refId`);--> statement-breakpoint
CREATE UNIQUE INDEX `junction_urls_attachedToId_refId_unique` ON `junction_urls` (`attachedToId`,`refId`);--> statement-breakpoint
CREATE TABLE `junction_time_entries` (
	`attachedToId` text NOT NULL,
	`refId` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`attachedToId`, `refId`),
	FOREIGN KEY (`refId`) REFERENCES `time_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `junction_time_entries_attachedToId_refId_idx` ON `junction_time_entries` (`attachedToId`,`refId`);--> statement-breakpoint
CREATE UNIQUE INDEX `junction_time_entries_attachedToId_refId_unique` ON `junction_time_entries` (`attachedToId`,`refId`);