import { areas, goals } from '@d/database/schemas'
import { syncSupporters } from '@d/domain/supporters'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { areasData, goalsData } from '@d/database/seed/data'
import { eq } from 'drizzle-orm'
import { Logger } from '@c/Logger'

/** Populates the database with default areas and goals when neither table already contains data. */
export const runSeed = async ({
  areasToSeed,
  goalsToSeed,
}: {
  areasToSeed?: typeof areasData
  goalsToSeed?: typeof goalsData
} = {}) => {
  const logger = Logger.getInstance()
  logger.debug('Running seed data...')

  areasToSeed = areasToSeed || areasData
  goalsToSeed = goalsToSeed || goalsData

  const uDB = UnHussleDB.getInstance()
  const db = await uDB.getDb()

  // check if areas and goals tables are empty
  const areaCount = await db.$count(areas)
  const goalCount = await db.$count(goals)

  if (areaCount > 0 || goalCount > 0) {
    logger.debug('Areas or Goals table is not empty. Skipping seed data.')
    return
  }

  // Insert areas
  for (const area of areasToSeed) {
    const addedArea = await db
      .insert(areas)
      .values({
        title: area.title,
        description: area.description,
        color: area.color,
        icon: area.icon,
      })
      .onConflictDoNothing()
      .returning()

    if (!addedArea || addedArea.length === 0) {
      logger.warn(
        `Area with title "${area.title}" could not be inserted. Skipping associated tags.`,
      )
      continue
    }

    if (area.tags && area.tags.length > 0) {
      const areaId = addedArea[0].id
      db.transaction((tx) => syncSupporters(tx, areaId, { tags: area.tags }))
    }
  }

  // Insert goals with correct area_id mapping
  for (const goal of goalsToSeed) {
    const area = await db.query.areas.findFirst({
      where: eq(areas.title, goal.mapToArea),
    })

    if (!area) {
      logger.warn(
        `Area with title "${goal.mapToArea}" not found. Skipping goal "${goal.title}".`,
      )
      continue
    }

    const addedGoal = await db
      .insert(goals)
      .values({
        title: goal.title,
        description: goal.description,
        due_date: goal.due_date,
        icon: goal.icon,
        color: area.color,
        area_id: area.id,
      })
      .onConflictDoNothing()
      .returning()

    if (!addedGoal || addedGoal.length === 0) {
      logger.warn(
        `Goal with title "${goal.title}" could not be inserted. Skipping associated tags.`,
      )
      continue
    }

    if (goal.tags && goal.tags.length > 0) {
      const goalId = addedGoal[0].id
      db.transaction((tx) => syncSupporters(tx, goalId, { tags: goal.tags }))
    }
  }

  logger.debug('Seed data inserted successfully.')
}
