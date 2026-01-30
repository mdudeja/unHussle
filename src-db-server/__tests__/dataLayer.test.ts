import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { Priority, ProgressStatus } from '@c/index'
import { eq } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import * as schema from 'src-db-server/database/schemas'
import { unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

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
  const testDbPath = join(tmpdir(), `unhussle-test-${Date.now()}.db`)

  beforeAll(async () => {
    process.env.DB_MIGRATIONS_DIR = join(__dirname, '../../drizzle_migrations')
    process.env.DB_FILE_URL = testDbPath

    db = await UnHussleDB.getInstance(testDbPath).getDb()
  })

  afterAll(async () => {
    //Clean up test database file
    try {
      await unlink(testDbPath)
    } catch (error) {
      console.warn('Failed to cleanup test database:', error)
    }
  })

  test('Create Tag', async () => {
    const [tag] = await db
      .insert(schema.tagsSchema)
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
      .insert(schema.areasSchema)
      .values({
        title: 'Test Area',
        status: ProgressStatus.PLANNED,
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
      .insert(schema.projectsSchema)
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
      .insert(schema.urlsSchema)
      .values({
        title: 'Test URL',
        url: 'https://example.com/test',
        protocol: 'https',
        domain: 'example.com',
        path: '/test',
        query: '',
        fragment: '',
      })
      .returning()

    expect(url.title).toBe('Test URL')
    expect(url.id).toBeTruthy()
    urlId = url.id
  })

  test('Create Goal', async () => {
    const [goal] = await db
      .insert(schema.goalsSchema)
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
      .insert(schema.resourcesSchema)
      .values({
        title: 'Test Resource',
        description: 'A useful resource',
        project_id: projectId,
      })
      .returning()

    expect(resource.title).toBe('Test Resource')
    expect(resource.project_id).toBe(projectId)
    expect(resource.id).toBeTruthy()
    resourceId = resource.id
  })

  test('Create Task Linked to Project', async () => {
    const [task] = await db
      .insert(schema.tasksSchema)
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
      .insert(schema.junctionTagsSchema)
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
      .insert(schema.junctionUrlsSchema)
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
      .insert(schema.timeEntriesSchema)
      .values({
        task_id: taskId,
        start_time: new Date(),
      })
      .returning()

    expect(timeEntry.task_id).toBe(taskId)
    expect(timeEntry.id).toBeTruthy()
    timeEntryId = timeEntry.id
  })

  test('Attach time entry to Task via Junction Table', async () => {
    const [junction] = await db
      .insert(schema.junctionTimeEntriesSchema)
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
      .insert(schema.junctionTagsSchema)
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
      .insert(schema.junctionUrlsSchema)
      .values({
        attachedToId: projectId,
        refId: urlId,
      })
      .returning()

    expect(junction.attachedToId).toBe(projectId)
    expect(junction.refId).toBe(urlId)
  })

  test('Query Task with Relations including Tags and URLs', async () => {
    const task = await db.query.tasksSchema.findFirst({
      where: eq(schema.tasksSchema.id, taskId),
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
    const task = await db.query.tasksSchema.findFirst({
      where: eq(schema.tasksSchema.id, taskId),
      with: {
        timeEntries: true,
      },
    })

    expect(task).toBeTruthy()
    expect(task?.timeEntries).toHaveLength(1)
    expect(task?.timeEntries[0]?.attachedToId).toBe(taskId)
  })

  test('Query Project with URL', async () => {
    const project = await db.query.projectsSchema.findFirst({
      where: eq(schema.projectsSchema.id, projectId),
      with: {
        urls: {
          with: {
            url: true,
          },
        },
        resources: true,
      },
    })

    expect(project).toBeTruthy()
    expect(project?.urls).toHaveLength(1)
    expect(project?.urls[0]?.url?.url).toBe('https://example.com/test')
    expect(project?.resources).toHaveLength(1)
    expect(project?.resources[0]?.title).toBe('Test Resource')
  })

  test('Query Resource with Tag', async () => {
    const resource = await db.query.resourcesSchema.findFirst({
      where: eq(schema.resourcesSchema.id, resourceId),
      with: {
        tags: {
          with: {
            tag: true,
          },
        },
        project: true,
      },
    })

    expect(resource).toBeTruthy()
    expect(resource?.tags).toHaveLength(1)
    expect(resource?.tags[0]?.tag?.title).toBe('Test Tag')
    expect(resource?.project?.title).toBe('Test Project')
  })

  test('Update Task', async () => {
    const [updated] = await db
      .update(schema.tasksSchema)
      .set({
        status: ProgressStatus.IN_PROGRESS,
      })
      .where(eq(schema.tasksSchema.id, taskId))
      .returning()

    expect(updated?.status).toBe(ProgressStatus.IN_PROGRESS)
  })

  test('Delete Task', async () => {
    await db.delete(schema.tasksSchema).where(eq(schema.tasksSchema.id, taskId))

    const found = await db.query.tasksSchema.findFirst({
      where: eq(schema.tasksSchema.id, taskId),
    })

    expect(found).toBeUndefined()
  })

  test('Cleanup', async () => {
    // Clean up junction tables first (foreign key constraints)
    await db
      .delete(schema.junctionTagsSchema)
      .where(eq(schema.junctionTagsSchema.attachedToId, taskId))
    await db
      .delete(schema.junctionTagsSchema)
      .where(eq(schema.junctionTagsSchema.attachedToId, resourceId))
    await db
      .delete(schema.junctionUrlsSchema)
      .where(eq(schema.junctionUrlsSchema.attachedToId, taskId))
    await db
      .delete(schema.junctionUrlsSchema)
      .where(eq(schema.junctionUrlsSchema.attachedToId, projectId))

    // Delete resources
    await db
      .delete(schema.resourcesSchema)
      .where(eq(schema.resourcesSchema.id, resourceId))

    // Delete projects and entities
    await db
      .delete(schema.projectsSchema)
      .where(eq(schema.projectsSchema.id, projectId))
    await db.delete(schema.areasSchema).where(eq(schema.areasSchema.id, areaId))
    await db.delete(schema.goalsSchema).where(eq(schema.goalsSchema.id, goalId))
    await db.delete(schema.tagsSchema).where(eq(schema.tagsSchema.id, tagId))
    await db.delete(schema.urlsSchema).where(eq(schema.urlsSchema.id, urlId))

    // Verify cleanup
    const project = await db.query.projectsSchema.findFirst({
      where: eq(schema.projectsSchema.id, projectId),
    })
    const area = await db.query.areasSchema.findFirst({
      where: eq(schema.areasSchema.id, areaId),
    })
    const goal = await db.query.goalsSchema.findFirst({
      where: eq(schema.goalsSchema.id, goalId),
    })
    const resource = await db.query.resourcesSchema.findFirst({
      where: eq(schema.resourcesSchema.id, resourceId),
    })
    const tag = await db.query.tagsSchema.findFirst({
      where: eq(schema.tagsSchema.id, tagId),
    })
    const url = await db.query.urlsSchema.findFirst({
      where: eq(schema.urlsSchema.id, urlId),
    })

    expect(project).toBeUndefined()
    expect(area).toBeUndefined()
    expect(goal).toBeUndefined()
    expect(resource).toBeUndefined()
    expect(tag).toBeUndefined()
    expect(url).toBeUndefined()
  })
})
