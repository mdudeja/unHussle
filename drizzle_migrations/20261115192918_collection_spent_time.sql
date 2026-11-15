ALTER TABLE `areas` ADD `spent_minutes` integer;--> statement-breakpoint
-- Time so far counts where each task belongs now, as each page counts tasks.
-- Completed items keep the total saved when they were completed.
UPDATE `projects` SET `spent_minutes` = (
  SELECT coalesce(sum(`spent_minutes`), 0) FROM `tasks`
  WHERE `tasks`.`project_id` = `projects`.`id`
) WHERE `spent_minutes` IS NULL;--> statement-breakpoint
UPDATE `goals` SET `spent_minutes` = (
  SELECT coalesce(sum(`spent_minutes`), 0) FROM `tasks`
  WHERE `tasks`.`goal_id` = `goals`.`id`
    OR `tasks`.`project_id` IN (SELECT `id` FROM `projects` WHERE `projects`.`goal_id` = `goals`.`id`)
) WHERE `spent_minutes` IS NULL;--> statement-breakpoint
UPDATE `areas` SET `spent_minutes` = (
  SELECT coalesce(sum(`spent_minutes`), 0) FROM `tasks`
  WHERE `tasks`.`area_id` = `areas`.`id`
    OR `tasks`.`goal_id` IN (SELECT `id` FROM `goals` WHERE `goals`.`area_id` = `areas`.`id`)
    OR `tasks`.`project_id` IN (
      SELECT `id` FROM `projects`
      WHERE `projects`.`area_id` = `areas`.`id`
        OR `projects`.`goal_id` IN (SELECT `id` FROM `goals` WHERE `goals`.`area_id` = `areas`.`id`)
    )
);
