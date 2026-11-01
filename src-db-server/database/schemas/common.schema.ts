import { createId } from '@paralleldrive/cuid2'
import { AnchorType, Priority, ProgressStatus } from '@c/types/index'
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

export const anchorTypeSchema = {
  anchor_type: customEnum<AnchorType>('anchor_type').default(
    AnchorType.any_after,
  ),
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
  custom_data: t.text({ mode: 'json' }).$type<Record<string, unknown>>(),
  ...timestampsSchema,
}

export const entityCollectionSchema = {
  id: t
    .text()
    .primaryKey()
    .$defaultFn(() => createId()),
  title: t.text().notNull(),
  ...prioritySchema,
  icon: t.text(),
  color: t.text(),
  description: t.text(),
  custom_data: t.text({ mode: 'json' }).$type<Record<string, unknown>>(),
  count_tasks: t.integer({ mode: 'number' }).default(0),
  count_resources: t.integer({ mode: 'number' }).default(0),
  ...timestampsSchema,
}

export const entitySupporterSchema = {
  id: t
    .text()
    .primaryKey()
    .$defaultFn(() => createId()),
  description: t.text(),
  count_tasks: t.integer({ mode: 'number' }).default(0),
  count_resources: t.integer({ mode: 'number' }).default(0),
  count_pga: t.integer({ mode: 'number' }).default(0),
  ...timestampsSchema,
}

export const junctionTableSchema = {
  attachedToId: t.text().notNull(),
  refId: t.text().notNull(),
  ...timestampsSchema,
}

export type RecurranceType = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type DailyRecurranceRule = {
  type: 'daily'
  data: {
    slots?: {
      from: number
      to: number
    }[]
  }
}

export type WeeklyRecurranceRule = {
  type: 'weekly'
  data: DailyRecurranceRule['data'] & {
    weekDays: number[]
  }
}

export type MonthlyRecurranceRule = {
  type: 'monthly'
  data: WeeklyRecurranceRule['data'] & {
    monthDays: number[]
  }
}

export type YearlyRecurranceRule = {
  type: 'yearly'
  data: MonthlyRecurranceRule['data'] & {
    months: number[]
  }
}

export type RecurranceRule =
  | DailyRecurranceRule
  | WeeklyRecurranceRule
  | MonthlyRecurranceRule
  | YearlyRecurranceRule
