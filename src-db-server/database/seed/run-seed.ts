import { areas, goals } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { areasData, goalsData } from '@d/database/seed/data'
import { eq } from 'drizzle-orm'
import { Logger } from '@c/Logger'

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
    await db.insert(areas).values(area)
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

    await db.insert(goals).values({
      title: goal.title,
      description: goal.description,
      due_date: goal.due_date,
      icon: goal.icon,
      color: area.color,
      area_id: area.id,
    })
  }

  logger.debug('Seed data inserted successfully.')
}
