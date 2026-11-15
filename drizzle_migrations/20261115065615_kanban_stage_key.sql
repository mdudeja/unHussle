-- Kanban's stage moves under its own extension key: { stage } -> { kanban: { stage } }.
UPDATE `tasks`
SET `custom_data` = json_set(
  json_remove(`custom_data`, '$.stage'),
  '$.kanban',
  json_object('stage', json_extract(`custom_data`, '$.stage'))
)
WHERE json_type(`custom_data`, '$.stage') IS NOT NULL;
