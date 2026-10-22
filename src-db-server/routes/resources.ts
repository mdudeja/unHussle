import {
  insertResourceSchema,
  selectResourceSchema,
  updateResourceSchema,
} from '@d/database/validation'
import { routeGenerator } from './routegenerator'
import { resources } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { ResourcesRepository } from '@d/database/repositories/resources'

export const resourcesRoutes = routeGenerator({
  name: 'resources',
  prefix: '/resources',
  schemas: {
    insert: insertResourceSchema,
    select: selectResourceSchema,
    update: updateResourceSchema,
    base: resources,
  },
  repository: new ResourcesRepository(UnHussleDB.getInstance()),
})
