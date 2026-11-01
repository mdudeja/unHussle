import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { SchedulerSettings } from '@c/scheduler/contracts'

export const schedulerSettings = sqliteTable('scheduler_settings', {
  id: text().primaryKey(),
  settings: text({ mode: 'json' }).$type<SchedulerSettings>().notNull(),
})
