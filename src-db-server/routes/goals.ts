import { goalsSchema } from '@d/database/schemas'
import {
  insertGoalSchema,
  selectGoalSchema,
  updateGoalSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

export const goalRoutes = routeGenerator({
  name: 'goals',
  prefix: '/goals',
  schemas: {
    insert: insertGoalSchema,
    select: selectGoalSchema,
    update: updateGoalSchema,
    base: goalsSchema,
  },
})
