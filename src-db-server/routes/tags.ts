import { eq } from 'drizzle-orm'
import { Value } from '@sinclair/typebox/value'
import {
  AreasRepository,
  GoalsRepository,
  ProjectsRepository,
  TagsRepository,
  TasksRepository,
} from '@d/database/repositories'
import { junctionTags, tags } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertTagsSchema,
  selectTagItemsSchema,
  selectTagsSchema,
  updateTagsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

const uDB = UnHussleDB.getInstance()
const repository = new TagsRepository(uDB)
const tasksRepository = new TasksRepository(uDB)
const projectsRepository = new ProjectsRepository(uDB)
const areasRepository = new AreasRepository(uDB)
const goalsRepository = new GoalsRepository(uDB)

const tagRoutes = routeGenerator({
  name: 'tags',
  prefix: '/tags',
  kind: 'tags',
  schemas: {
    insert: insertTagsSchema,
    select: selectTagsSchema,
    update: updateTagsSchema,
    base: tags,
  },
  repository: repository,
})

tagRoutes.get(
  '/:id/items',
  async ({ params: { id }, logger }) => {
    logger.debug(`Get items tagged with tag id: ${id}`)
    const tag = await repository.getById(id)
    if (!tag) {
      throw new Error('NOT_FOUND')
    }

    const db = await uDB.getDb()
    // `attachedToId` has no foreign key, so it may point at any entity table;
    // each repository only returns the ids that belong to it.
    const ids = db
      .select({ id: junctionTags.attachedToId })
      .from(junctionTags)
      .where(eq(junctionTags.refId, id))
      .all()
      .map((row) => row.id)

    const [tasks, projects, areas, goals] = await Promise.all([
      tasksRepository.getByIds(ids),
      projectsRepository.getByIds(ids),
      areasRepository.getByIds(ids),
      goalsRepository.getByIds(ids),
    ])

    const dependentTasks = await tasksRepository.getByQuery({
      project_id: projects.map((p) => p.id),
      area_id: areas.map((a) => a.id),
      goal_id: goals.map((g) => g.id),
    })

    tasks.push(
      ...dependentTasks.filter((t) => !tasks.some((task) => task.id === t.id)),
    )

    return Value.Parse(selectTagItemsSchema, { tasks, projects, areas, goals })
  },
  {
    response: selectTagItemsSchema,
  },
)

export { tagRoutes }
