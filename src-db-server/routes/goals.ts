import { GoalsRepository } from '@d/database/repositories/goals'
import { goals } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertGoalSchema,
  selectGoalSchema,
  updateGoalSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

export const goalRoutes = routeGenerator({
  name: 'goals',
  prefix: '/goals',
  kind: 'goals',
  schemas: {
    insert: insertGoalSchema,
    select: selectGoalSchema,
    update: updateGoalSchema,
    base: goals,
  },
  repository: new GoalsRepository(UnHussleDB.getInstance()),
})
