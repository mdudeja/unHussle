import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import EntityRefBadge from '@/components/ui/custom/EntityRefBadge'
import { expect, test } from 'bun:test'
import { entityRegistry, toFormValues } from '@/lib/entityActions/registry'
import { submittedFormValues } from '@/components/ui/custom/entityForms/utils'
import type { FieldConfig } from '@/components/ui/custom/entityForms/types'
import { ProgressStatus, Priority } from '@c/types/enums'

const sources = {
  projects: { data: [] },
  areas: { data: [] },
  goals: { data: [] },
}

test('creation defaults stay separate from edit fallbacks and resources keep editor navigation', () => {
  expect(entityRegistry.tasks.createDefaults).toMatchObject({
    status: ProgressStatus.PLANNED,
    priority: Priority.MEDIUM,
    is_recurring: false,
  })
  expect(entityRegistry.areas.createDefaults).toEqual({
    priority: Priority.MEDIUM,
  })
  expect(entityRegistry.tasks.createDefaults).not.toBe(
    entityRegistry.tasks.formDefaults,
  )
  expect(entityRegistry.resources.createdRoute?.('note')).toBe(
    '/resources/note',
  )
  for (const entry of Object.values(entityRegistry))
    expect(entry.createFields(sources).length).toBeGreaterThan(0)
})

test('an edit round trip submits direct attachments without inherited context or computed totals', () => {
  const fields = entityRegistry.tasks.createFields(sources) as FieldConfig<
    Record<string, unknown>
  >[]
  const own = [{ id: 'own' }]
  const item = {
    id: 'task',
    title: 'Task',
    resources: own,
    tags: [{ title: 'direct' }],
    inherited: [{ resources: [{ id: 'ancestor-note' }] }],
    resolved_task_total: 42,
    count_tasks: 3,
  }
  const values = toFormValues(item, fields)
  const submitted = submittedFormValues(values, fields)
  expect(submitted.resources).toEqual(own)
  expect(submitted.tags).toEqual([{ title: 'direct' }])
  expect(submitted).not.toHaveProperty('inherited')
  expect(submitted).not.toHaveProperty('resolved_task_total')
  expect(submitted).not.toHaveProperty('count_tasks')
  expect(submitted).not.toHaveProperty('id')
})

test('hidden fields clear stale values and unknown properties cannot become new links', () => {
  const fields: FieldConfig<Record<string, unknown>>[] = [
    { name: 'title', label: 'Title', type: 'text' },
    {
      name: 'recurrance_rule',
      label: 'Repeat',
      type: 'recurrance',
      visibleWhen: () => false,
    },
  ]
  expect(
    submittedFormValues(
      {
        title: 'Draft',
        recurrance_rule: { type: 'daily' },
        resources: [{ id: 'inherited' }],
      },
      fields,
    ),
  ).toEqual({ title: 'Draft', recurrance_rule: null })
})

test('relation badges render supplied labels without a paginated entity list', () => {
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      {},
      createElement(EntityRefBadge, {
        kind: 'projects',
        record: {
          id: 'outside-current-page',
          title: 'Referenced project',
          color: '#123456',
        },
      }),
    ),
  )
  expect(markup).toContain('Referenced')
  expect(markup).toContain('/projects/outside-current-page')
  expect(markup).toContain('#123456')
})
