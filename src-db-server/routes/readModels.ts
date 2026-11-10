import { Priority, ProgressStatus } from '@c/types/enums'
import { t } from 'elysia'

export const taskPageQuerySchema = t.Object({
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  q: t.Optional(t.String({ maxLength: 500 })),
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
  // UnionEnum supplies a first-value default even when optional. Patterns keep omitted filters absent.
  sort: t.Optional(
    t.String({
      pattern:
        '^(id|title|status|priority|due_date|scheduled_start|scheduled_end|updated_at|created_at)$',
    }),
  ),
  direction: t.Optional(t.String({ pattern: '^(asc|desc)$' })),
  is_fun: t.Optional(t.String({ pattern: '^(true|false)$' })),
  is_chore: t.Optional(t.String({ pattern: '^(true|false)$' })),
  is_quick: t.Optional(t.String({ pattern: '^(true|false)$' })),
})
export const referencesQuerySchema = t.Object({
  q: t.Optional(t.String({ maxLength: 500 })),
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  ids: t.Optional(t.String({ maxLength: 10000 })),
})
