import { TasksRepository } from '@d/database/repositories/tasks'
import { Priority, ProgressStatus } from '@c/types/enums'
import { ReadModelsRepository } from '@d/database/repositories/readModels'
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { createBackendRuntime } from '@d/workflows/runtime'
import { AreasRepository } from '@d/database/repositories/areas'
import { GoalsRepository } from '@d/database/repositories/goals'
import { ProjectsRepository } from '@d/database/repositories/projects'
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
/** Extracts the identifiers from the given rows and returns them sorted. */
const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort()
/** Returns the IDs of the task items in a row. */
const memberIds = (row: { tasks: { items: { id: string }[] } }) =>
  ids(row.tasks.items)

/** Sets up an isolated in-memory database and vault with seeded areas, goals, projects, tasks, URLs, and resources for testing membership and backlink behavior. */
async function fixture() {
  const database = new UnHussleDB(':memory:')
  const db = await database.getDb()
  const vaultDir = mkdtempSync(join(tmpdir(), 'membership-vault-'))
  roots.push(vaultDir)
  const runtime = createBackendRuntime(database, { vaultDir })
  /** Creates a new entry of the given kind from the provided changes. */
  const create = async (kind: EntryKind, changes: Record<string, unknown>) =>
    (await runtime.commands.execute(`${commandHeadForKind[kind]}.add`, {
      kind,
      action: 'create',
      changes,
    })) as EntryRecord
  /** Applies the specified changes to an existing entry identified by kind and id. */
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
  test('task pages filter before limiting, keep totals and visit every member once', async () => {
    const f = await fixture()
    try {
      const reads = new ReadModelsRepository(f.database)
      for (const kind of ['areas', 'tags', 'urls'] as const) {
        const id =
          kind === 'areas' ? f.area.id : kind === 'tags' ? f.tag.id : f.url.id
        const seen: string[] = []
        let cursor: string | undefined
        do {
          const detail = await reads.detail(kind, id, {
            limit: 2,
            cursor,
            sort: 'updated_at',
            direction: 'desc',
          })
          expect(detail.tasks.items.length).toBeLessThanOrEqual(2)
          expect(detail.tasks.total).toBe(f.allAreaTasks.length)
          seen.push(...detail.tasks.items.map((row) => row.id))
          cursor = detail.tasks.nextCursor ?? undefined
          expect(detail.item).not.toHaveProperty('tasks')
        } while (cursor)
        expect(seen.sort()).toEqual(f.allAreaTasks)
        expect(new Set(seen).size).toBe(seen.length)
      }
      const target = await f.create('tasks', {
        title: 'Unique filtered task',
        area_id: f.area.id,
        is_fun: true,
      })
      const filtered = await reads.detail('areas', f.area.id, {
        q: 'Unique filtered',
        is_fun: 'true',
        limit: 1,
      })
      expect(ids(filtered.tasks.items)).toEqual([target.id])
      expect(filtered.tasks.total).toBe(1)
      expect(filtered.tasks.nextCursor).toBeNull()
      const first = await reads.detail('areas', f.area.id, { limit: 1 })
      expect(first.tasks.nextCursor).not.toBeNull()
      await expect(
        reads.detail('areas', f.area.id, {
          cursor: first.tasks.nextCursor!,
          q: 'different',
        }),
      ).rejects.toThrow('Invalid task cursor')
      await expect(
        reads.detail('projects', f.project.id, {
          cursor: first.tasks.nextCursor!,
        }),
      ).rejects.toThrow('Invalid task cursor')
      await expect(
        reads.detail('areas', f.area.id, { cursor: 'broken' }),
      ).rejects.toThrow('Invalid task cursor')
      await expect(
        reads.detail('areas', f.area.id, { limit: 101 }),
      ).rejects.toThrow('Limit')
    } finally {
      f.runtime.dispose()
    }
  })

  test('list projections retain active tracking without carrying closed history', async () => {
    const f = await fixture()
    try {
      const reads = new ReadModelsRepository(f.database)
      const tasks = new TasksRepository(f.database)
      await f.change('tasks', f.tasks.directProject, {
        status: ProgressStatus.IN_PROGRESS,
      })
      const active = await reads.detail('projects', f.project.id)
      expect(
        active.tasks.items.find((row) => row.id === f.tasks.directProject)
          ?.timeEntries,
      ).toHaveLength(1)
      await f.change('tasks', f.tasks.directProject, {
        status: ProgressStatus.PAUSED,
      })
      const paused = await reads.detail('projects', f.project.id)
      expect(
        paused.tasks.items.find((row) => row.id === f.tasks.directProject)
          ?.timeEntries,
      ).toEqual([])
      expect(
        (await tasks.getById(f.tasks.directProject))?.timeEntries,
      ).toHaveLength(1)
      await f.change('tasks', f.tasks.directProject, { priority: Priority.LOW })
      await f.change('tasks', f.tasks.multiplePaths, {
        priority: Priority.HIGH,
      })
      const first = await reads.detail('projects', f.project.id, {
        sort: 'priority',
        limit: 1,
      })
      expect(first.tasks.items[0].id).toBe(f.tasks.directProject)
      const second = await reads.detail('projects', f.project.id, {
        sort: 'priority',
        limit: 1,
        cursor: first.tasks.nextCursor!,
      })
      expect(second.tasks.items[0].id).toBe(f.tasks.multiplePaths)
      expect(second.tasks.nextCursor).toBeNull()
    } finally {
      f.runtime.dispose()
    }
  })

  test('reference projections contain labels and metadata without entity trees or content', async () => {
    const f = await fixture()
    try {
      const reads = new ReadModelsRepository(f.database)
      const ref = await reads.references('projects', { ids: [f.project.id] })
      expect(ref.items[0]).toMatchObject({
        id: f.project.id,
        title: f.project.title,
      })
      expect(ref.items[0].tags?.map((row) => row.title)).toContain(
        String(f.tag.title),
      )
      for (const key of [
        'tasks',
        'resources',
        'description',
        'custom_data',
        'content',
      ])
        expect(ref.items[0]).not.toHaveProperty(key)
      const all: string[] = []
      let cursor: string | undefined
      do {
        const page = await reads.references('projects', { limit: 1, cursor })
        all.push(...page.items.map((row) => row.id))
        cursor = page.nextCursor ?? undefined
      } while (cursor)
      expect(new Set(all).size).toBe(all.length)
      expect(all).toContain(f.project.id)
      const search = await reads.references('projects', {
        q: String(f.tag.title),
      })
      expect(ids(search.items)).toContain(f.project.id)
      expect(
        (await reads.references('resources', { ids: [f.resource.id] }))
          .items[0],
      ).not.toHaveProperty('content')
      const detail = await reads.detail('projects', f.project.id)
      expect(detail.tasks.items[0].project?.title).toBe(String(f.project.title))
      expect(detail.tasks.items[0].project).not.toHaveProperty('description')
      expect(detail.tasks.items[0]).not.toHaveProperty('resources')
      expect(detail.tasks.items[0]).not.toHaveProperty('urls')
      expect(detail.directRelations.resources).toEqual([])
    } finally {
      f.runtime.dispose()
    }
  })

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
          expect(row).not.toHaveProperty('tasks')
          expect(
            memberIds(
              await new ReadModelsRepository(f.database).detail(kind, owner.id),
            ),
          ).toEqual(expected)
          expect(row?.resolved_task_total).toBe(expected.length)
          // Every baseline collection has exactly two directly assigned tasks.
          expect(row?.count_tasks).toBe(2)
        }
        expect(
          ids(
            (await new ReadModelsRepository(f.database).detail(kind, owner.id))
              .tasks.items,
          ),
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
        expect(ids(items.tasks.items)).toEqual(f.allAreaTasks)
        expect(items.tasks.total).toBe(items.tasks.items.length)
        expect(countTaskMembership(f.db, { kind, id })).toBe(
          items.tasks.items.length,
        )
        expect(new Set(items.tasks.items.map((task) => task.id)).size).toBe(
          items.tasks.items.length,
        )
        expect(ids(items.directRelations.projects)).toEqual([f.project.id])
        expect(ids(items.directRelations.areas)).toEqual([f.area.id])
        expect(items.directRelations.goals).toEqual([])
        expect(ids(items.directRelations.resources)).toEqual([f.resource.id])
        expect(ids(items.tasks.items)).not.toContain(f.tasks.unrelated)
        expect(
          items.tasks.items.find((task) => task.id === f.tasks.multiplePaths)
            ?.tags?.[0].title,
        ).toBe(String(f.tag.title))
        expect(items.directRelations.resources[0]).not.toHaveProperty('content')
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
        expect(ids(items.tasks.items)).toEqual(
          [f.tasks.directProject, f.tasks.multiplePaths].sort(),
        )
        expect(items.tasks.total).toBe(2)
        expect(ids(items.directRelations.projects)).toEqual([f.project.id])
        expect(items.directRelations.areas).toEqual([])
        expect(items.directRelations.goals).toEqual([])
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
        expect(ids(items.tasks.items)).toEqual(f.goalTasks)
        expect(items.tasks.total).toBe(f.goalTasks.length)
        expect(ids(items.directRelations.goals)).toEqual([f.goal.id])
        expect(items.directRelations.projects).toEqual([])
        expect(items.directRelations.areas).toEqual([])
      } finally {
        f.runtime.dispose()
      }
    },
  )

  test('cross-parent paths use containment while context still inherits upward and editable links stay direct', async () => {
    const f = await fixture()
    try {
      const area = await new AreasRepository(f.database).getById(f.otherArea.id)
      expect(
        memberIds(
          await new ReadModelsRepository(f.database).detail(
            'areas',
            f.otherArea.id,
          ),
        ),
      ).toEqual([f.crossTask.id])
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
        await expect(
          new ReadModelsRepository(f.database).detail(kind, 'missing'),
        ).rejects.toThrow('NOT_FOUND')
        expect(countTaskMembership(f.db, container)).toBe(0)
      }
      for (const kind of ['tags', 'urls'] as const) {
        const row = await f.create(
          kind,
          kind === 'tags'
            ? { title: 'Empty membership' }
            : { url: 'https://empty.example/' },
        )
        expect((await f.supporters.getItems(kind, row.id)).tasks).toEqual({
          items: [],
          total: 0,
          nextCursor: null,
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
        ids(
          (
            await new ReadModelsRepository(f.database).detail(
              'goals',
              f.goal.id,
            )
          ).tasks.items,
        ),
      ).toEqual(remainingGoalTasks)
      expect(countTaskMembership(f.db, { kind: 'goals', id: f.goal.id })).toBe(
        remainingGoalTasks.length,
      )
      // The tag still directly owns this project as well as the old area.
      expect(
        ids((await f.supporters.getItems('tags', f.tag.id)).tasks.items),
      ).toEqual(f.allAreaTasks)
    } finally {
      f.runtime.dispose()
    }
  })
})
