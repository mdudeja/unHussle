import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { UnHussleDB } from '@d/database/UnHussleDB'
import * as schema from 'src-db-server/database/schemas'
import { unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { runSeed } from '@d/database/seed/run-seed'

describe('Seed Data Tests', () => {
  let db: BunSQLiteDatabase<typeof schema>
  const testDbPath = join(tmpdir(), `unhussle-test-sd-${Date.now()}.db`)

  beforeAll(async () => {
    process.env.DB_MIGRATIONS_DIR = join(__dirname, '../../drizzle_migrations')
    process.env.DB_FILE_URL = testDbPath

    db = await UnHussleDB.getInstance(testDbPath).getDb()

    await runSeed()
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

  test('Seed data is inserted correctly', async () => {
    // Verify areas
    const areas = await db.select().from(schema.areas)
    expect(areas.length).toBeGreaterThan(0)

    // Verify goals
    const goals = await db.select().from(schema.goals)
    expect(goals.length).toBeGreaterThan(0)

    // Check that each goal's area_id corresponds to an existing area
    for (const goal of goals) {
      const area = areas.find((a) => a.id === goal.area_id)
      expect(area).toBeDefined()
    }
  })

  test('Running seed again does not duplicate data', async () => {
    const initialAreaCount = await db.$count(schema.areas)
    const initialGoalCount = await db.$count(schema.goals)

    await runSeed()

    const finalAreaCount = await db.$count(schema.areas)
    const finalGoalCount = await db.$count(schema.goals)

    expect(finalAreaCount).toBe(initialAreaCount)
    expect(finalGoalCount).toBe(initialGoalCount)
  })

  test('Goals have correct area associations', async () => {
    const goals = await db.select().from(schema.goals)
    const areas = await db.select().from(schema.areas)

    for (const goal of goals) {
      const area = areas.find((a) => a.id === goal.area_id)
      expect(area).toBeDefined()
    }
  })

  test('Skips adding goal if mapped area does not exist', async () => {
    // Insert a goal with a non-existent area mapping
    const fakeGoal = {
      title: 'Non-existent Area Goal',
      description: 'This goal maps to an area that does not exist',
      due_date: Date.now(),
      icon: '🎯',
      mapToArea: 'Area That Does Not Exist',
      tags: [{ title: 'nonexistent-area-goal', color: '#000000' }],
    }

    await db.delete(schema.goals)
    await db.delete(schema.areas)

    const initialGoalCount = await db.$count(schema.goals)

    await runSeed({
      goalsToSeed: [fakeGoal],
    })

    const finalGoalCount = await db.$count(schema.goals)

    // Goal count should remain the same
    expect(finalGoalCount).toBe(initialGoalCount)
  })
})
