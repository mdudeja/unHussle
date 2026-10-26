import {
  insertAreaSchema,
  selectAreaSchema,
  updateAreaSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'
import { areas } from '@d/database/schemas'
import { AreasRepository } from '@d/database/repositories/areas'
import { UnHussleDB } from '@d/database/UnHussleDB'

export const areaRoutes = routeGenerator({
  name: 'areas',
  prefix: '/areas',
  kind: 'areas',
  schemas: {
    insert: insertAreaSchema,
    select: selectAreaSchema,
    update: updateAreaSchema,
    base: areas,
  },
  repository: new AreasRepository(UnHussleDB.getInstance()),
})
