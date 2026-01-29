import {
  insertAreaSchema,
  selectAreaSchema,
  updateAreaSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'
import { areasSchema } from '@d/database/schemas'

export const areaRoutes = routeGenerator({
  name: 'areas',
  prefix: '/areas',
  schemas: {
    insert: insertAreaSchema,
    select: selectAreaSchema,
    update: updateAreaSchema,
    base: areasSchema,
  },
})
