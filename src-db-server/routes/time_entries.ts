import { timeEntriesSchema } from '@d/database/schemas'
import {
  insertTimeEntriesSchema,
  selectTimeEntriesSchema,
  updateTimeEntriesSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

export const timeEntriesRoutes = routeGenerator({
  name: 'time_entries',
  prefix: '/time_entries',
  schemas: {
    insert: insertTimeEntriesSchema,
    select: selectTimeEntriesSchema,
    update: updateTimeEntriesSchema,
    base: timeEntriesSchema,
  },
})
