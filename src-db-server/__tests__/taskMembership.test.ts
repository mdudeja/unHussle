import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { createBackendRuntime } from '@d/workflows/runtime'
import { AreasRepository } from '@d/database/repositories/areas'
import { GoalsRepository } from '@d/database/repositories/goals'
import { ProjectsRepository } from '@d/database/repositories/projects'
import { TasksRepository } from '@d/database/repositories/tasks'
import { SupporterItemsRepository } from '@d/database/repositories/supporterItems'
import {
  countTaskMembership,
  type TaskContainer,
} from '@d/database/repositories/taskMembership'
import { getTaskContext } from '@d/database/repositories/taskContext'
import { junctionUrls } from '@d/database/schemas'
import { createRelationshipFixture } from '@c/testing/relationshipFixture'
import {
  commandHeadForKind,
  type EntryKind,
  type EntryRecord,
} from '@c/workflows/contracts'

const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})
const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort()
const memberIds = (row: { tasks?: { id: string }[] } | null) =>
  ids(row?.tasks ?? [])

async function fixture() {
  const database = new UnHussleDB(':memory:')
  const db = await database.getDb()
  const vaultDir = mkdtempSync(join(tmpdir(), 'membership-vault-'))
  roots.push(vaultDir)
  const runtime = createBackendRuntime(database, { vaultDir })
  const create = async (kind: EntryKind, changes: Record<string, unknown>) =>
    (await runtime.commands.execute(`${commandHeadForKind[kind]}.add`, {
      kind,
      action: 'create',
      changes,
    })) as EntryRecord
  const change = (
    kind: EntryKind,
    id: string,
    changes: Record<string, unknown>,
  ) =>
    runtime.commands.execute(`${commandHeadForKind[kind]}.change`, {
      kind,
      action: 'update',
      id,
      changes,
    })
  const base = await createRelationshipFixture(create)
  const otherArea = await create('areas', { title: 'Other area' })
  const otherGoal = await create('goals', {
    title: 'Other goal',
    area_id: otherArea.id,
  })
  const crossProject = await create('projects', {
    title: 'Cross project',
    area_id: base.area.id,
    goal_id: otherGoal.id,
  })
  const crossTask = await create('tasks', {
    title: 'Cross task',
    project_id: crossProject.id,
  })
  const url = await create('urls', {
    title: 'Membership URL',
    url: 'https://membership.example/',
  })
  for (const [kind, id] of [
    ['areas', base.area.id],
    ['projects', base.project.id],
    ['tasks', base.tasks.multiplePaths],
  ] as const)
    await change(kind, id, { urls: [{ url: url.url, title: url.title }] })
  const resource = await create('resources', {
    title: 'Directly tagged resource',
    tags: [{ title: base.tag.title }],
    links: [{ kind: 'tasks', id: base.tasks.unrelated }],
  })
  // A legacy resource URL attachment also must not traverse backlinks into tasks.
  db.insert(junctionUrls)
    .values({ refId: url.id, attachedToId: resource.id })
    .run()
  const inheritedResource = await create('resources', {
    title: 'Goal context',
    links: [{ kind: 'goals', id: base.goal.id }],
  })
  const task = new TasksRepository(database)
  const supporters = new SupporterItemsRepository(database)
  const allAreaTasks = [
    ...Object.entries(base.tasks)
      .filter(([name]) => name !== 'unrelated')
      .map(([, id]) => id),
    crossTask.id,
  ].sort()
  const goalTasks = [
    'directGoal',
    'directProject',
    'multiplePaths',
    'sibling',
    'indirect',
  ]
    .map((name) => base.tasks[name])
    .sort()
  return {
    ...base,
    database,
    db,
    runtime,
    task,
    supporters,
    create,
    change,
    url,
    resource,
    inheritedResource,
    otherArea,
    otherGoal,
    crossTask,
    crossProject,
    allAreaTasks,
    goalTasks,
  }
}

describe('Task membership containment', () => {
  test('resolved totals are computed reads and cannot overwrite direct counts', async () => {
    const f = await fixture()
    try {
      await f.change('goals', f.goal.id, {
        resolved_task_total: 999,
        count_tasks: 999,
      })
      const goal = await new GoalsRepository(f.database).getById(f.goal.id)
      expect(goal?.count_tasks).toBe(2)
      expect(goal?.resolved_task_total).toBe(f.goalTasks.length)
    } finally {
      f.runtime.dispose()
    }
  })
  test('all collection read entry points use the same downward membership and total', async () => {
    const f = await fixture()
    try {
      const cases = [
        {
          kind: 'projects',
          repository: new ProjectsRepository(f.database),
          owner: f.project,
          expected: [f.tasks.directProject, f.tasks.multiplePaths].sort(),
        },
        {
          kind: 'goals',
          repository: new GoalsRepository(f.database),
          owner: f.goal,
          expected: f.goalTasks,
        },
        {
          kind: 'areas',
          repository: new AreasRepository(f.database),
          owner: f.area,
          expected: f.allAreaTasks,
        },
      ] as const
      for (const { kind, repository, owner, expected } of cases) {
        const outputs = [
          await repository.getById(owner.id),
          (await repository.getAll()).find((row) => row.id === owner.id),
          (await repository.getPaginated(0, 50)).find(
            (row) => row.id === owner.id,
          ),
          (await repository.search(String(owner.title), 50)).find(
            (row) => row.id === owner.id,
          ),
          (await repository.getByIds([owner.id]))[0],
        ]
        for (const row of outputs) {
          expect(row).toBeDefined()
          expect(memberIds(row!)).toEqual(expected)
          expect(row?.resolved_task_total).toBe(expected.length)
          // Every baseline collection has exactly two directly assigned tasks.
          expect(row?.count_tasks).toBe(2)
        }
        expect(
          ids(await f.task.getByMembership({ kind, id: owner.id })),
        ).toEqual(expected)
        expect(countTaskMembership(f.db, { kind, id: owner.id })).toBe(
          expected.length,
        )
      }
    } finally {
      f.runtime.dispose()
    }
  })

  test.each(['tags', 'urls'] as const)(
    '%s resolves direct tasks and attached collections through every descendant path',
    async (kind) => {
      const f = await fixture()
      try {
        const id = kind === 'tags' ? f.tag.id : f.url.id
        const items = await f.supporters.getItems(kind, id)
        expect(ids(items.tasks)).toEqual(f.allAreaTasks)
        expect(items.resolved_task_total).toBe(items.tasks.length)
        expect(countTaskMembership(f.db, { kind, id })).toBe(items.tasks.length)
        expect(new Set(items.tasks.map((task) => task.id)).size).toBe(
          items.tasks.length,
        )
        expect(ids(items.projects)).toEqual([f.project.id])
        expect(ids(items.areas)).toEqual([f.area.id])
        expect(items.goals).toEqual([])
        expect(ids(items.resources)).toEqual([f.resource.id])
        expect(ids(items.tasks)).not.toContain(f.tasks.unrelated)
        expect(
          items.tasks.find((task) => task.id === f.tasks.multiplePaths)
            ?.tags?.[0].title,
        ).toBe(String(f.tag.title))
        expect(items.resources[0]).not.toHaveProperty('content')
      } finally {
        f.runtime.dispose()
      }
    },
  )

  test.each(['tags', 'urls'] as const)(
    '%s attached only to a project excludes its parents and sibling projects',
    async (kind) => {
      const f = await fixture()
      try {
        const supporter = await f.create(
          kind,
          kind === 'tags'
            ? { title: 'Project-only tag' }
            : { url: 'https://project-only.example/' },
        )
        await f.change('projects', f.project.id, {
          [kind]:
            kind === 'tags'
              ? [{ title: supporter.title }]
              : [{ url: supporter.url }],
        })
        const items = await f.supporters.getItems(kind, supporter.id)
        expect(ids(items.tasks)).toEqual(
          [f.tasks.directProject, f.tasks.multiplePaths].sort(),
        )
        expect(items.resolved_task_total).toBe(2)
        expect(ids(items.projects)).toEqual([f.project.id])
        expect(items.areas).toEqual([])
        expect(items.goals).toEqual([])
      } finally {
        f.runtime.dispose()
      }
    },
  )

  test.each(['tags', 'urls'] as const)(
    '%s attached only to a goal expands its projects without including parent-area tasks',
    async (kind) => {
      const f = await fixture()
      try {
        const supporter = await f.create(
          kind,
          kind === 'tags'
            ? { title: 'Goal-only tag' }
            : { url: 'https://goal-only.example/' },
        )
        await f.change('goals', f.goal.id, {
          [kind]:
            kind === 'tags'
              ? [{ title: supporter.title }]
              : [{ url: supporter.url }],
        })
        const items = await f.supporters.getItems(kind, supporter.id)
        expect(ids(items.tasks)).toEqual(f.goalTasks)
        expect(items.resolved_task_total).toBe(f.goalTasks.length)
        expect(ids(items.goals)).toEqual([f.goal.id])
        expect(items.projects).toEqual([])
        expect(items.areas).toEqual([])
      } finally {
        f.runtime.dispose()
      }
    },
  )

  test('cross-parent paths use containment while context still inherits upward and editable links stay direct', async () => {
    const f = await fixture()
    try {
      const area = await new AreasRepository(f.database).getById(f.otherArea.id)
      expect(memberIds(area)).toEqual([f.crossTask.id])
      expect(area?.resolved_task_total).toBe(1)
      expect(area?.count_tasks).toBe(0)
      const project = await new ProjectsRepository(f.database).getById(
        f.project.id,
      )
      expect(project?.resources).toEqual([])
      expect(project?.goal).not.toHaveProperty('tasks')
      expect(project?.area).not.toHaveProperty('tasks')
      expect(project?.resolved_task_total).toBe(2)
      const context = getTaskContext(f.db, f.tasks.directProject)
      expect(
        context?.inherited.flatMap((group) =>
          group.resources.map((resource) => resource.id),
        ),
      ).toContain(f.inheritedResource.id)
      expect(context?.own.resources).toEqual([])
      const ownerArea = await new AreasRepository(f.database).getById(f.area.id)
      expect(ownerArea?.resources).toEqual([])
      expect(ownerArea?.projects?.some((row) => 'tasks' in row)).toBe(false)
      expect(ownerArea?.goals?.some((row) => 'tasks' in row)).toBe(false)
    } finally {
      f.runtime.dispose()
    }
  })

  test('unknown and empty memberships never fall back to every task', async () => {
    const f = await fixture()
    try {
      for (const kind of [
        'projects',
        'areas',
        'goals',
        'tags',
        'urls',
      ] as const) {
        const container: TaskContainer = { kind, id: 'missing' }
        expect(await f.task.getByMembership(container)).toEqual([])
        expect(countTaskMembership(f.db, container)).toBe(0)
      }
      for (const kind of ['tags', 'urls'] as const) {
        const row = await f.create(
          kind,
          kind === 'tags'
            ? { title: 'Empty membership' }
            : { url: 'https://empty.example/' },
        )
        expect(await f.supporters.getItems(kind, row.id)).toEqual({
          tasks: [],
          projects: [],
          areas: [],
          goals: [],
          resources: [],
          resolved_task_total: 0,
        })
        await expect(f.supporters.getItems(kind, 'missing')).rejects.toThrow(
          'NOT_FOUND',
        )
      }
    } finally {
      f.runtime.dispose()
    }
  })

  test('reparenting is reflected by collection/supporter retrieval and counts without cached membership', async () => {
    const f = await fixture()
    try {
      await f.change('projects', f.project.id, {
        goal_id: f.otherGoal.id,
        area_id: f.otherArea.id,
      })
      const remainingGoalTasks = f.goalTasks.filter(
        (id) => id !== f.tasks.directProject,
      )
      // multiplePaths remains a direct member of the original goal and area.
      expect(
        ids(await f.task.getByMembership({ kind: 'goals', id: f.goal.id })),
      ).toEqual(remainingGoalTasks)
      expect(countTaskMembership(f.db, { kind: 'goals', id: f.goal.id })).toBe(
        remainingGoalTasks.length,
      )
      // The tag still directly owns this project as well as the old area.
      expect(
        ids((await f.supporters.getItems('tags', f.tag.id)).tasks),
      ).toEqual(f.allAreaTasks)
    } finally {
      f.runtime.dispose()
    }
  })
})
