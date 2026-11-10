import { ReadModelsRepository } from '@d/database/repositories/readModels'
import type { Url } from '@d/database/schemas/urls.schema'
import { createBackendRuntime } from '@d/workflows/runtime'
import {
  commandHeadForKind,
  type EntryKind,
  type MutationResult,
} from '@c/workflows/contracts'
import type { WithSupporters, Task, Tag } from '@c/types'
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { Priority, ProgressStatus } from '@c/types/enums'
import { eq } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import * as schema from 'src-db-server/database/schemas'
import { unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { getNowMillis } from '@c/datetimeUtils'
import {
  AreasRepository,
  GoalsRepository,
  ProjectsRepository,
  TasksRepository,
} from '@d/database/repositories'

describe('Data Layer Tests', () => {
  let db: BunSQLiteDatabase<typeof schema>
  let tagId: string
  let urlId: string
  let areaId: string
  let goalId: string
  let projectId: string
  let taskId: string
  let resourceId: string
  let timeEntryId: string
  const testDbPath = join(tmpdir(), `unhussle-test-dl-${Date.now()}.db`)

  beforeAll(async () => {
    process.env.DB_MIGRATIONS_DIR = join(__dirname, '../../drizzle_migrations')
    process.env.DB_FILE_URL = testDbPath

    db = await UnHussleDB.getInstance(testDbPath).getDb()
  })

  afterAll(async () => {
    //Clean up test database file
    try {
      await unlink(testDbPath)
      await unlink(`${testDbPath}-shm`)
      await unlink(`${testDbPath}-wal`)
    } catch (error) {
      console.warn('Failed to cleanup test database:', error)
    }
  })

  test('Create Tag', async () => {
    const [tag] = await db
      .insert(schema.tags)
      .values({
        title: 'Test Tag',
        color: '#ff0000',
      })
      .returning()

    expect(tag.title).toBe('Test Tag')
    expect(tag.id).toBeTruthy()
    tagId = tag.id
  })

  test('Create Area', async () => {
    const [area] = await db
      .insert(schema.areas)
      .values({
        title: 'Test Area',
        priority: Priority.MEDIUM,
        icon: 'folder',
      })
      .returning()

    expect(area.title).toBe('Test Area')
    expect(area.id).toBeTruthy()
    areaId = area.id
  })

  test('Create Project Linked to Area', async () => {
    const [project] = await db
      .insert(schema.projects)
      .values({
        title: 'Test Project',
        status: ProgressStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        area_id: areaId,
      })
      .returning()

    expect(project.title).toBe('Test Project')
    expect(project.area_id).toBe(areaId)
    projectId = project.id
  })

  test('Create URL', async () => {
    const [url] = await db
      .insert(schema.urls)
      .values({
        title: 'Test URL',
        url: 'https://example.com/test',
      })
      .returning()

    expect(url.title).toBe('Test URL')
    expect(url.id).toBeTruthy()
    urlId = url.id
  })

  test('Create File URL', async () => {
    const [url] = await db
      .insert(schema.urls)
      .values({
        title: 'Test File URL',
        url: 'file:///path/to/local/file',
      })
      .returning()

    expect(url.title).toBe('Test File URL')
    expect(url.id).toBeTruthy()
  })

  test('Create Goal', async () => {
    const [goal] = await db
      .insert(schema.goals)
      .values({
        title: 'Test Goal',
        status: ProgressStatus.PLANNED,
        priority: Priority.HIGH,
        progress: 0,
      })
      .returning()

    expect(goal.title).toBe('Test Goal')
    expect(goal.id).toBeTruthy()
    goalId = goal.id
  })

  test('Create Resource', async () => {
    const [resource] = await db
      .insert(schema.resources)
      .values({
        title: 'Test Resource',
        description: 'A useful resource',
      })
      .returning()
    await db
      .insert(schema.junctionResources)
      .values({ attachedToId: projectId, refId: resource.id })

    expect(resource.title).toBe('Test Resource')
    expect(resource.id).toBeTruthy()
    resourceId = resource.id
  })

  test('Create Task Linked to Project', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values({
        title: 'Test Task',
        status: ProgressStatus.PLANNED,
        priority: Priority.MEDIUM,
        project_id: projectId,
        goal_id: goalId,
      })
      .returning()

    expect(task.title).toBe('Test Task')
    expect(task.project_id).toBe(projectId)
    expect(task.goal_id).toBe(goalId)
    taskId = task.id
  })

  test('Attach Tag to Task via Junction Table', async () => {
    const [junction] = await db
      .insert(schema.junctionTags)
      .values({
        attachedToId: taskId,
        refId: tagId,
      })
      .returning()

    expect(junction.attachedToId).toBe(taskId)
    expect(junction.refId).toBe(tagId)
  })

  test('Attach URL to Task via Junction Table', async () => {
    const [junction] = await db
      .insert(schema.junctionUrls)
      .values({
        attachedToId: taskId,
        refId: urlId,
      })
      .returning()

    expect(junction.attachedToId).toBe(taskId)
    expect(junction.refId).toBe(urlId)
  })

  test('Create time entry linked to Task', async () => {
    const [timeEntry] = await db
      .insert(schema.timeEntries)
      .values({
        task_id: taskId,
        start_time: getNowMillis(),
      })
      .returning()

    expect(timeEntry.task_id).toBe(taskId)
    expect(timeEntry.id).toBeTruthy()
    timeEntryId = timeEntry.id
  })

  test('Attach time entry to Task via Junction Table', async () => {
    const [junction] = await db
      .insert(schema.junctionTimeEntries)
      .values({
        attachedToId: taskId,
        refId: timeEntryId,
      })
      .returning()

    expect(junction.attachedToId).toBe(taskId)
    expect(junction.refId).toBe(timeEntryId)
  })

  test('Attach Tag to Resource', async () => {
    const [junction] = await db
      .insert(schema.junctionTags)
      .values({
        attachedToId: resourceId,
        refId: tagId,
      })
      .returning()

    expect(junction.attachedToId).toBe(resourceId)
    expect(junction.refId).toBe(tagId)
  })

  test('Attach URL to Project', async () => {
    const [junction] = await db
      .insert(schema.junctionUrls)
      .values({
        attachedToId: projectId,
        refId: urlId,
      })
      .returning()

    expect(junction.attachedToId).toBe(projectId)
    expect(junction.refId).toBe(urlId)
  })

  test('Query Task with Relations including Tags and URLs', async () => {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
      with: {
        project: true,
        area: true,
        goal: true,
        tags: {
          with: {
            tag: true,
          },
        },
        urls: {
          with: {
            url: true,
          },
        },
      },
    })

    expect(task).toBeTruthy()
    expect(task?.title).toBe('Test Task')
    expect(task?.project?.title).toBe('Test Project')
    expect(task?.project?.area_id).toBe(areaId)
    expect(task?.goal?.title).toBe('Test Goal')
    expect(task?.tags).toHaveLength(1)
    expect(task?.tags[0]?.tag?.title).toBe('Test Tag')
    expect(task?.urls).toHaveLength(1)
    expect(task?.urls[0]?.url?.url).toBe('https://example.com/test')
  })

  test('Query Task with Time Entries', async () => {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
      with: {
        timeEntries: true,
      },
    })

    expect(task).toBeTruthy()
    expect(task?.timeEntries).toHaveLength(1)
    expect(task?.timeEntries[0]?.attachedToId).toBe(taskId)
  })

  test('Query Project with URL', async () => {
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      with: {
        urls: {
          with: {
            url: true,
          },
        },
        resources: { with: { resource: true } },
      },
    })

    expect(project).toBeTruthy()
    expect(project?.urls).toHaveLength(1)
    expect(project?.urls[0]?.url?.url).toBe('https://example.com/test')
    expect(project?.resources).toHaveLength(1)
    expect(project?.resources[0]?.resource?.title).toBe('Test Resource')
  })

  test('Query Resource with Tag', async () => {
    const resource = await db.query.resources.findFirst({
      where: eq(schema.resources.id, resourceId),
      with: {
        tags: {
          with: {
            tag: true,
          },
        },
        links: { with: { project: true } },
      },
    })

    expect(resource).toBeTruthy()
    expect(resource?.tags).toHaveLength(1)
    expect(resource?.tags[0]?.tag?.title).toBe('Test Tag')
    expect(resource?.links[0]?.project?.title).toBe('Test Project')
  })

  test('Update Task', async () => {
    const [updated] = await db
      .update(schema.tasks)
      .set({
        status: ProgressStatus.IN_PROGRESS,
      })
      .where(eq(schema.tasks.id, taskId))
      .returning()

    expect(updated?.status).toBe(ProgressStatus.IN_PROGRESS)
  })

  test('Delete Task', async () => {
    await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId))

    const found = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
    })

    expect(found).toBeUndefined()
  })

  test('Cleanup', async () => {
    // Clean up junction tables first (foreign key constraints)
    await db
      .delete(schema.junctionTags)
      .where(eq(schema.junctionTags.attachedToId, taskId))
    await db
      .delete(schema.junctionTags)
      .where(eq(schema.junctionTags.attachedToId, resourceId))
    await db
      .delete(schema.junctionUrls)
      .where(eq(schema.junctionUrls.attachedToId, taskId))
    await db
      .delete(schema.junctionUrls)
      .where(eq(schema.junctionUrls.attachedToId, projectId))

    // Delete resources
    await db.delete(schema.resources).where(eq(schema.resources.id, resourceId))

    // Delete projects and entities
    await db.delete(schema.projects).where(eq(schema.projects.id, projectId))
    await db.delete(schema.areas).where(eq(schema.areas.id, areaId))
    await db.delete(schema.goals).where(eq(schema.goals.id, goalId))
    await db.delete(schema.tags).where(eq(schema.tags.id, tagId))
    await db.delete(schema.urls).where(eq(schema.urls.id, urlId))

    // Verify cleanup
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })
    const area = await db.query.areas.findFirst({
      where: eq(schema.areas.id, areaId),
    })
    const goal = await db.query.goals.findFirst({
      where: eq(schema.goals.id, goalId),
    })
    const resource = await db.query.resources.findFirst({
      where: eq(schema.resources.id, resourceId),
    })
    const tag = await db.query.tags.findFirst({
      where: eq(schema.tags.id, tagId),
    })
    const url = await db.query.urls.findFirst({
      where: eq(schema.urls.id, urlId),
    })

    expect(project).toBeUndefined()
    expect(area).toBeUndefined()
    expect(goal).toBeUndefined()
    expect(resource).toBeUndefined()
    expect(tag).toBeUndefined()
    expect(url).toBeUndefined()
  })

  describe('Tags and URLs written with an entity', () => {
    const repositories = () => {
      const uDB = UnHussleDB.getInstance(testDbPath)
      const entries = [
        ['task', new TasksRepository(uDB)],
        ['project', new ProjectsRepository(uDB)],
        ['area', new AreasRepository(uDB)],
        ['goal', new GoalsRepository(uDB)],
      ] as const
      const runtime = createBackendRuntime(uDB)
      return entries.map(([name, read]) => {
        const kind = `${name}s` as EntryKind
        const head = commandHeadForKind[kind]
        const hydrate = (result: MutationResult) =>
          runtime.hydrate<{
            id: string
            title: string
            tags?: Tag['Read'][]
            urls?: Url['Read'][]
          }>(result, (id) => read.getById(id))
        return [
          name,
          {
            add: async (changes: WithSupporters<Task['Write']>) =>
              hydrate(
                await runtime.commands.execute(`${head}.add`, {
                  kind,
                  action: 'create',
                  changes,
                }),
              ),
            update: async (
              id: string,
              changes: WithSupporters<Task['Update']>,
            ) =>
              hydrate(
                await runtime.commands.execute(`${head}.change`, {
                  kind,
                  action: 'update',
                  id,
                  changes,
                }),
              ),
            delete: async (id: string) =>
              runtime.commands.execute(`${head}.delete`, {
                kind,
                action: 'delete',
                id,
              }) as Promise<{ id: string }>,
          },
        ] as const
      })
    }

    const junctionTagIds = (attachedToId: string) =>
      db
        .select({ refId: schema.junctionTags.refId })
        .from(schema.junctionTags)
        .where(eq(schema.junctionTags.attachedToId, attachedToId))
        .all()
    const junctionUrlIds = (attachedToId: string) =>
      db
        .select({ refId: schema.junctionUrls.refId })
        .from(schema.junctionUrls)
        .where(eq(schema.junctionUrls.attachedToId, attachedToId))
        .all()

    test('add creates missing tags/urls and links them', async () => {
      const [existing] = await db
        .insert(schema.tags)
        .values({ title: 'existing', color: '#123456' })
        .returning()

      for (const [name, repository] of repositories()) {
        const added = await repository.add({
          title: `Attached ${name}`,
          tags: [
            { title: '#Existing', color: '#ffffff' },
            { title: `new_${name}` },
            { title: `NEW_${name}` },
          ],
          urls: [
            { url: 'https://example.com/shared' },
            { url: `https://example.com/${name}`, title: name },
          ],
        })

        expect(added).toBeTruthy()
        expect(added.tags?.map((tag) => tag.title).sort()).toEqual(
          ['existing', `new_${name}`].sort(),
        )
        expect(added.urls?.map((url) => url.url).sort()).toEqual(
          ['https://example.com/shared', `https://example.com/${name}`].sort(),
        )
        expect(
          added.urls?.find((url) => url.url.endsWith(name))?.parts?.hostname,
        ).toBe('example.com')
        expect(junctionTagIds(added.id)).toHaveLength(2)
        expect(junctionUrlIds(added.id)).toHaveLength(2)
      }

      // Existing tag/url rows are reused, not duplicated or overwritten
      const existingRows = db
        .select()
        .from(schema.tags)
        .where(eq(schema.tags.title, 'existing'))
        .all()
      expect(existingRows).toHaveLength(1)
      expect(existingRows[0].id).toBe(existing.id)
      expect(existingRows[0].color).toBe('#123456')
      expect(
        db
          .select()
          .from(schema.urls)
          .where(eq(schema.urls.url, 'https://example.com/shared'))
          .all(),
      ).toHaveLength(1)
    })

    test('update replaces only the relations present in the body', async () => {
      for (const [name, repository] of repositories()) {
        const added = await repository.add({
          title: `Replace ${name}`,
          tags: [{ title: 'keep' }, { title: 'drop' }],
          urls: [{ url: 'https://example.com/keep' }],
        })

        // Absent keys leave relations untouched
        const renamed = await repository.update(added.id, {
          title: `Renamed ${name}`,
        })
        expect(renamed.title).toBe(`Renamed ${name}`)
        expect(renamed.tags).toHaveLength(2)
        expect(renamed.urls).toHaveLength(1)

        const replaced = await repository.update(added.id, {
          tags: [{ title: 'keep' }, { title: 'added' }],
        })
        expect(replaced.tags?.map((tag) => tag.title).sort()).toEqual([
          'added',
          'keep',
        ])
        expect(replaced.urls).toHaveLength(1)

        const cleared = await repository.update(added.id, {
          tags: [],
          urls: [],
        })
        expect(cleared.tags).toEqual([])
        expect(cleared.urls).toEqual([])
        expect(junctionTagIds(added.id)).toHaveLength(0)
        expect(junctionUrlIds(added.id)).toHaveLength(0)
      }
    })

    test('update of a missing entity rejects', async () => {
      for (const [, repository] of repositories()) {
        await expect(
          repository.update('missing-id', { tags: [{ title: 'x' }] }),
        ).rejects.toThrow('NOT_FOUND')
      }
      expect(junctionTagIds('missing-id')).toHaveLength(0)
    })

    test('delete removes junction rows', async () => {
      for (const [name, repository] of repositories()) {
        const added = await repository.add({
          title: `Delete ${name}`,
          tags: [{ title: 'doomed' }],
          urls: [{ url: 'https://example.com/doomed' }],
        })

        const deleted = await repository.delete(added.id)
        expect(deleted?.id).toBe(added.id)
        expect(junctionTagIds(added.id)).toHaveLength(0)
        expect(junctionUrlIds(added.id)).toHaveLength(0)

        // The tag/url records themselves stay
        expect(
          db
            .select()
            .from(schema.tags)
            .where(eq(schema.tags.title, 'doomed'))
            .all(),
        ).toHaveLength(1)
      }
    })
  })

  describe('Collection details include tasks of linked collections', () => {
    // area ← goal ← goalProject (no area_id), and area ← areaProject
    const ids = {} as Record<
      | 'area'
      | 'goal'
      | 'areaProject'
      | 'goalProject'
      | 'areaTask'
      | 'sharedTask'
      | 'goalTask'
      | 'goalProjectTask'
      | 'goalProjectResource',
      string
    >
    const taskIds = (entity: { tasks: { items: { id: string }[] } }) =>
      entity.tasks.items.map((task) => task.id).sort()
    const detail = (kind: 'areas' | 'goals' | 'projects', id: string) =>
      new ReadModelsRepository(UnHussleDB.getInstance(testDbPath)).detail(
        kind,
        id,
      )
    const sorted = (...values: string[]) => [...values].sort()

    beforeAll(async () => {
      const [area] = await db
        .insert(schema.areas)
        .values({ title: 'Members Area' })
        .returning()
      const [goal] = await db
        .insert(schema.goals)
        .values({ title: 'Members Goal', area_id: area.id })
        .returning()
      const [areaProject] = await db
        .insert(schema.projects)
        .values({ title: 'Area Project', area_id: area.id })
        .returning()
      const [goalProject] = await db
        .insert(schema.projects)
        .values({ title: 'Goal Project', goal_id: goal.id })
        .returning()
      const addTask = async (values: Partial<Task['Write']>) =>
        (
          await db
            .insert(schema.tasks)
            .values({ title: 'Member Task', ...values })
            .returning()
        )[0].id
      const [goalProjectResource] = await db
        .insert(schema.resources)
        .values({ title: 'Goal Project Resource' })
        .returning()
      await db
        .insert(schema.junctionResources)
        .values({ attachedToId: goalProject.id, refId: goalProjectResource.id })

      Object.assign(ids, {
        area: area.id,
        goal: goal.id,
        areaProject: areaProject.id,
        goalProject: goalProject.id,
        areaTask: await addTask({ area_id: area.id }),
        sharedTask: await addTask({
          area_id: area.id,
          project_id: areaProject.id,
        }),
        goalTask: await addTask({ goal_id: goal.id }),
        goalProjectTask: await addTask({ project_id: goalProject.id }),
        goalProjectResource: goalProjectResource.id,
      })
    })

    test('area reaches tasks through its projects, goals and goal projects', async () => {
      const area = await new AreasRepository(
        UnHussleDB.getInstance(testDbPath),
      ).getById(ids.area)

      expect(taskIds(await detail('areas', ids.area))).toEqual(
        sorted(ids.areaTask, ids.sharedTask, ids.goalTask, ids.goalProjectTask),
      )
      // Resources stay direct-only: forms are filled from this row
      expect(area?.resources).toEqual([])
      // Only directly linked projects are listed, and nested rows keep their base shape
      expect(area?.projects?.map((project) => project.id)).toEqual([
        ids.areaProject,
      ])
      expect(area?.projects?.[0]).not.toHaveProperty('tasks')
      expect(area?.goals?.[0]).not.toHaveProperty('tasks')
      expect(area?.goals?.[0]).not.toHaveProperty('projects')
    })

    test('goal reaches its own and project tasks without parent area tasks', async () => {
      const goal = await new GoalsRepository(
        UnHussleDB.getInstance(testDbPath),
      ).getById(ids.goal)

      expect(taskIds(await detail('goals', ids.goal))).toEqual(
        sorted(ids.goalTask, ids.goalProjectTask),
      )
      expect(goal?.area).not.toHaveProperty('tasks')
    })

    test('project includes direct tasks without parent or sibling tasks', async () => {
      expect(taskIds(await detail('projects', ids.goalProject))).toEqual(
        sorted(ids.goalProjectTask),
      )
      // A task with multiple paths still appears only once in its project.
      expect(taskIds(await detail('projects', ids.areaProject))).toEqual(
        sorted(ids.sharedTask),
      )
    })
  })
})
