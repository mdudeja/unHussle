import {
  insertProjectSchema,
  selectProjectSchema,
  updateProjectSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'
import { projects } from '@d/database/schemas'

export const projectRoutes = routeGenerator({
  name: 'projects',
  prefix: '/projects',
  schemas: {
    insert: insertProjectSchema,
    select: selectProjectSchema,
    update: updateProjectSchema,
    base: projects,
  },
})
