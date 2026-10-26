import {
  insertProjectSchema,
  selectProjectSchema,
  updateProjectSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'
import { projects } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { ProjectsRepository } from '@d/database/repositories/projects'

export const projectRoutes = routeGenerator({
  name: 'projects',
  prefix: '/projects',
  kind: 'projects',
  schemas: {
    insert: insertProjectSchema,
    select: selectProjectSchema,
    update: updateProjectSchema,
    base: projects,
  },
  repository: new ProjectsRepository(UnHussleDB.getInstance()),
})
