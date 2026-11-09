import { eq } from 'drizzle-orm'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { tags, urls, junctionTags, junctionUrls } from '@d/database/schemas'
import type { SupporterItems } from '@c/types/Hydrated'
import { TasksRepository } from './tasks'
import { ProjectsRepository } from './projects'
import { AreasRepository } from './areas'
import { GoalsRepository } from './goals'
import { ResourcesRepository } from './resources'
import { countTaskMembership } from './taskMembership'

/** One read path for tag and URL attachments and their downward task membership. */
export class SupporterItemsRepository {
  private readonly tasks: TasksRepository
  private readonly projects: ProjectsRepository
  private readonly areas: AreasRepository
  private readonly goals: GoalsRepository
  private readonly resources: ResourcesRepository

  constructor(private readonly database: UnHussleDB) {
    this.tasks = new TasksRepository(database)
    this.projects = new ProjectsRepository(database)
    this.areas = new AreasRepository(database)
    this.goals = new GoalsRepository(database)
    this.resources = new ResourcesRepository(database)
  }

  async getItems(kind: 'tags' | 'urls', id: string): Promise<SupporterItems> {
    const db = await this.database.getDb()
    const table = kind === 'tags' ? tags : urls
    if (!db.select({ id: table.id }).from(table).where(eq(table.id, id)).get())
      throw new Error('NOT_FOUND')
    const junction = kind === 'tags' ? junctionTags : junctionUrls
    const ids = db
      .select({ id: junction.attachedToId })
      .from(junction)
      .where(eq(junction.refId, id))
      .all()
      .map((row) => row.id)
    const [tasks, projects, areas, goals, resources] = await Promise.all([
      this.tasks.getByMembership({ kind, id }),
      this.projects.getByIds(ids),
      this.areas.getByIds(ids),
      this.goals.getByIds(ids),
      this.resources.getByIds(ids),
    ])
    return {
      tasks,
      projects,
      areas,
      goals,
      resources,
      resolved_task_total: countTaskMembership(db, { kind, id }),
    }
  }
}
