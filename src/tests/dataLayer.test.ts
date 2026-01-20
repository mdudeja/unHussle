import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { UnHussleDB } from '@/services/database/UnHussleDB'
import { Priority, ProgressStatus } from '@/types'
import { tasksSchema } from '@/services/database/schemas/tasks.schema'
import { areasSchema } from '@/services/database/schemas/areas.schema'
import { projectsSchema } from '@/services/database/schemas/projects.schema'
import { entityTagsSchema } from '@/services/database/schemas/entity_tags.schema'
import { eq } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import * as schema from '@/services/database/schemas'
import { unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

describe('Data Layer Tests', () => {
  let db: BunSQLiteDatabase<typeof schema>
  let tagId: string
  let areaId: string
  let projectId: string
  let taskId: string
  const testDbPath = join(tmpdir(), `unhussle-test-${Date.now()}.db`)

  beforeAll(async () => {
    db = await UnHussleDB.getInstance(testDbPath).getDb()

    // Run migrations to create tables
    migrate(db, { migrationsFolder: './drizzle_migrations' })
  })

  afterAll(async () => {
    // Clean up test database file
    try {
      await unlink(testDbPath)
    } catch (error) {
      console.warn('Failed to cleanup test database:', error)
    }
  })

  test('Create Tag', async () => {
    const [tag] = await db
      .insert(entityTagsSchema)
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
      .insert(areasSchema)
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
      .insert(projectsSchema)
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

  test('Create Task Linked to Project with Tag', async () => {
    const [task] = await db
      .insert(tasksSchema)
      .values({
        title: 'Test Task',
        status: ProgressStatus.PLANNED,
        priority: Priority.MEDIUM,
        project_id: projectId,
        spent_minutes: 0,
        is_recurring: false,
        is_fun: false,
        is_chore: false,
        stack_order: 0,
        tag_ids: [tagId],
        url_ids: [],
        time_entry_ids: [],
      })
      .returning()

    expect(task.title).toBe('Test Task')
    expect(task.project_id).toBe(projectId)
    expect(task.tag_ids).toContain(tagId)
    taskId = task.id
  })

  test('Query Task with Relations', async () => {
    const task = await db.query.tasksSchema.findFirst({
      where: eq(tasksSchema.id, taskId),
      with: {
        project: true,
        area: true,
      },
    })

    expect(task).toBeTruthy()
    expect(task?.title).toBe('Test Task')
    expect(task?.project?.title).toBe('Test Project')
    expect(task?.project?.area_id).toBe(areaId)
  })

  test('Update Task', async () => {
    const [updated] = await db
      .update(tasksSchema)
      .set({
        status: ProgressStatus.IN_PROGRESS,
      })
      .where(eq(tasksSchema.id, taskId))
      .returning()

    expect(updated?.status).toBe(ProgressStatus.IN_PROGRESS)
  })

  test('Delete Task', async () => {
    await db.delete(tasksSchema).where(eq(tasksSchema.id, taskId))

    const found = await db.query.tasksSchema.findFirst({
      where: eq(tasksSchema.id, taskId),
    })

    expect(found).toBeUndefined()
  })

  test('Cleanup', async () => {
    await db.delete(projectsSchema).where(eq(projectsSchema.id, projectId))
    await db.delete(areasSchema).where(eq(areasSchema.id, areaId))
    await db.delete(entityTagsSchema).where(eq(entityTagsSchema.id, tagId))

    // Verify cleanup
    const project = await db.query.projectsSchema.findFirst({
      where: eq(projectsSchema.id, projectId),
    })
    const area = await db.query.areasSchema.findFirst({
      where: eq(areasSchema.id, areaId),
    })
    const tag = await db.query.entityTagsSchema.findFirst({
      where: eq(entityTagsSchema.id, tagId),
    })

    expect(project).toBeUndefined()
    expect(area).toBeUndefined()
    expect(tag).toBeUndefined()
  })
})
