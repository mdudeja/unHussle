import { createId } from '@paralleldrive/cuid2'
import { Priority, ProgressStatus } from '@c/types/index'
import * as t from 'drizzle-orm/sqlite-core'
import { getNowMillis } from '@c/datetimeUtils'

// Enums
const customEnum = <T>(name: string) =>
  t.customType<{
    data: T
  }>({
    dataType() {
      return 'text'
    },
  })(name)

// Common Schemas
export const timestampsSchema = {
  created_at: t
    .integer({ mode: 'number' })
    .notNull()
    .$default(() => getNowMillis()),
  updated_at: t
    .integer({ mode: 'number' })
    .notNull()
    .$onUpdate(() => getNowMillis()),
}

export const prioritySchema = {
  priority: customEnum<Priority>('priority').default(Priority.MEDIUM),
}

export const statusSchema = {
  status: customEnum<ProgressStatus>('status').default(ProgressStatus.PLANNED),
}

// Parent Schemas
export const entitySchema = {
  id: t
    .text()
    .primaryKey()
    .$defaultFn(() => createId()),
  title: t.text().notNull(),
  description: t.text(),
  project_id: t.text('project_id'),
  area_id: t.text('area_id'),
  goal_id: t.text('goal_id'),
  ...timestampsSchema,
}

export const entityCollectionSchema = {
  id: t
    .text()
    .primaryKey()
    .$defaultFn(() => createId()),
  title: t.text().notNull(),
  ...statusSchema,
  ...prioritySchema,
  icon: t.text(),
  color: t.text(),
  description: t.text(),
  ...timestampsSchema,
}

export const entitySupporterSchema = {
  id: t
    .text()
    .primaryKey()
    .$defaultFn(() => createId()),
  description: t.text(),
  ...timestampsSchema,
}

export const junctionTableSchema = {
  attachedToId: t.text().notNull(),
  refId: t.text().notNull(),
  ...timestampsSchema,
}
