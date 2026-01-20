import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { entitySchema, prioritySchema, statusSchema } from './common.schema'
import { Entity, InferTableTypes } from '@/types'

export const tasksSchema = sqliteTable('tasks', {
  ...entitySchema,
  ...statusSchema,
  ...prioritySchema,
  estimated_minutes: integer({ mode: 'number' }),
  spent_minutes: integer({ mode: 'number' }).notNull().default(0),
  due_date: integer({ mode: 'timestamp_ms' }),
  is_recurring: integer({ mode: 'boolean' }).notNull().default(false),
  recurring_rule: text(),
  is_fun: integer({ mode: 'boolean' }).notNull().default(false),
  is_chore: integer({ mode: 'boolean' }).notNull().default(false),
  stack_order: integer({ mode: 'number' }).notNull().default(0),
  scheduled_for: integer({ mode: 'timestamp_ms' }),
  completed_at: integer({ mode: 'timestamp_ms' }),
})

export type Task = InferTableTypes<Entity, typeof tasksSchema>
