import { Priority, ProgressStatus } from '@c/types/enums'
import { ProjectsRepository } from './projects'
import { AreasRepository } from './areas'
import { GoalsRepository } from './goals'
import { ResourcesRepository } from './resources'
import {
  and,
  asc,
  desc,
  count,
  eq,
  gt,
  lt,
  sql,
  inArray,
  like,
  or,
} from 'drizzle-orm'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import {
  areas,
  goals,
  projects,
  resources,
  tags,
  tasks,
  urls,
  timeEntries,
  junctionTags,
  junctionUrls,
} from '@d/database/schemas'
import type { EntryKind } from '@c/workflows/contracts'
import type {
  ContainerDetail,
  EntityReference,
  ReadContainerKind,
  ReadPage,
  TaskPageOptions,
} from '@c/types/readModels'
import { taskMembershipPredicate } from './taskMembership'
import { TasksRepository } from './tasks'
import {
  taggedIds,
  withResources,
  unwrapJunctions,
  withTags,
  withUrls,
} from './helpers'

const tables = {
  areas,
  goals,
  projects,
  resources,
  tags,
  tasks,
  urls,
  time_entries: timeEntries,
}
export class ReadInputError extends Error {}

/** Read projections only; resource content is never queried here. */
export class ReadModelsRepository {
  constructor(private readonly database: UnHussleDB) {}

  async references(
    kind: EntryKind,
    options: {
      q?: string
      cursor?: string
      limit?: number
      ids?: string[]
    } = {},
  ): Promise<ReadPage<EntityReference>> {
    const db = await this.database.getDb()
    const table = tables[kind]
    const limit = options.limit ?? 50
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ReadInputError('Limit must be between 1 and 100')
    const where = and(
      options.q
        ? or(
            like(table.title, `%${options.q}%`),
            inArray(table.id, taggedIds(db, `%${options.q}%`)),
          )
        : undefined,
      options.ids ? inArray(table.id, options.ids) : undefined,
    )
    const total = db.select({ total: count() }).from(table).where(where).get()!
      .total
    const rows = db
      .select({ id: table.id, title: table.title })
      .from(table)
      .where(
        and(where, options.cursor ? gt(table.id, options.cursor) : undefined),
      )
      .orderBy(asc(table.id))
      .limit(limit + 1)
      .all()
    const selected = rows.slice(0, limit)
    const ids = selected.map((row) => row.id)
    // One batch per page, never one query per reference.
    const attachedTags = ids.length
      ? db
          .select({
            owner: junctionTags.attachedToId,
            id: tags.id,
            title: tags.title,
          })
          .from(junctionTags)
          .innerJoin(tags, eq(tags.id, junctionTags.refId))
          .where(inArray(junctionTags.attachedToId, ids))
          .orderBy(asc(junctionTags.refId))
          .all()
      : []
    const tagsByOwner = new Map<string, { id: string; title: string }[]>()
    for (const { owner, id, title } of attachedTags) {
      const own = tagsByOwner.get(owner) ?? []
      own.push({ id, title })
      tagsByOwner.set(owner, own)
    }
    const metadata =
      (kind === 'projects' || kind === 'areas' || kind === 'goals') &&
      ids.length
        ? db
            .select({
              id: tables[kind].id,
              icon: tables[kind].icon,
              color: tables[kind].color,
            })
            .from(tables[kind])
            .where(inArray(tables[kind].id, ids))
            .all()
        : []
    const byId = new Map(metadata.map((row) => [row.id, row]))
    return {
      items: selected.map((row) => ({
        ...row,
        title: row.title ?? '',
        ...byId.get(row.id),
        tags: tagsByOwner.get(row.id) ?? [],
      })),
      total,
      nextCursor: rows.length > limit ? selected[selected.length - 1].id : null,
    }
  }

  async detail(
    kind: ReadContainerKind,
    id: string,
    options: TaskPageOptions = {},
  ): Promise<ContainerDetail> {
    const db = await this.database.getDb()
    const table = tables[kind]
    const item = db.select().from(table).where(eq(table.id, id)).get()
    if (!item) throw new Error('NOT_FOUND')
    const limit = options.limit ?? 20
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ReadInputError('Limit must be between 1 and 100')
    // Cursor is scoped to container, filters and ordering; task ID breaks ties.
    const sorting = {
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      due_date: tasks.due_date,
      scheduled_start: tasks.scheduled_start,
      scheduled_end: tasks.scheduled_end,
      updated_at: tasks.updated_at,
      created_at: tasks.created_at,
    }

    const sort = options.sort ?? 'id'
    if (!Object.prototype.hasOwnProperty.call(sorting, sort))
      throw new ReadInputError('Unsupported task ordering')
    const column = sorting[sort as keyof typeof sorting]
    const numeric = [
      'due_date',
      'scheduled_start',
      'scheduled_end',
      'updated_at',
      'created_at',
    ].includes(sort)
    const enumValues =
      sort === 'priority'
        ? Object.values(Priority)
        : sort === 'status'
          ? Object.values(ProgressStatus)
          : undefined
    const sortValue = enumValues
      ? sql<string | number>`case ${column} ${sql.join(
          enumValues.map((value, index) => sql`when ${value} then ${index}`),
          sql` `,
        )} else -1 end`
      : sql<
          string | number
        >`coalesce(${column}, ${numeric ? Number.MIN_SAFE_INTEGER : ''})`

    const direction = options.direction ?? 'asc'
    if (!['asc', 'desc'].includes(direction))
      throw new ReadInputError('Unsupported task direction')

    const scope = JSON.stringify([
      kind,
      id,
      options.q ?? '',
      options.status ?? '',
      options.priority ?? '',
      sort,
      direction,
      options.is_fun ?? '',
      options.is_chore ?? '',
      options.is_quick ?? '',
    ])
    let after: { value: string | number; id: string } | undefined

    if (options.cursor) {
      try {
        const parsed: unknown = JSON.parse(
          Buffer.from(options.cursor, 'base64url').toString(),
        )
        if (
          !Array.isArray(parsed) ||
          parsed.length !== 3 ||
          parsed[0] !== scope ||
          (typeof parsed[1] !== 'string' && typeof parsed[1] !== 'number') ||
          typeof parsed[2] !== 'string'
        )
          throw new Error()
        after = { value: parsed[1], id: parsed[2] }
      } catch {
        throw new ReadInputError('Invalid task cursor for these filters')
      }
    }

    const predicate = and(
      taskMembershipPredicate(db, { kind, id }),
      options.q ? like(tasks.title, `%${options.q}%`) : undefined,
      options.status
        ? eq(
            tasks.status,
            options.status as NonNullable<typeof tasks.$inferSelect.status>,
          )
        : undefined,
      options.priority
        ? eq(
            tasks.priority,
            options.priority as NonNullable<typeof tasks.$inferSelect.priority>,
          )
        : undefined,
      ...(['is_fun', 'is_chore', 'is_quick'] as const).map((flag) =>
        options[flag] === undefined
          ? undefined
          : eq(tasks[flag], options[flag] === 'true'),
      ),
    )

    // Membership, filtering and ordering precede projection fetching.
    const { total, ids, more, last } = db.transaction((tx) => {
      const total = tx
        .select({ total: count() })
        .from(tasks)
        .where(predicate)
        .get()!.total
      const compare = direction === 'asc' ? gt : lt
      const order = direction === 'asc' ? asc : desc
      const found = tx
        .select({ id: tasks.id, value: sortValue })
        .from(tasks)
        .where(
          and(
            predicate,
            after
              ? or(
                  compare(sortValue, after.value),
                  and(eq(sortValue, after.value), compare(tasks.id, after.id)),
                )
              : undefined,
          ),
        )
        .orderBy(order(sortValue), order(tasks.id))
        .limit(limit + 1)
        .all()

      return {
        total,
        ids: found.slice(0, limit).map((row) => row.id),
        more: found.length > limit,
        last: found[Math.min(found.length, limit) - 1],
      }
    })

    const selected = await new TasksRepository(this.database).getListByIds(ids)
    const byId = new Map(selected.map((row) => [row.id, row]))
    const page = {
      items: ids.map((id) => byId.get(id)!),
      total,
      nextCursor: more
        ? Buffer.from(JSON.stringify([scope, last.value, last.id])).toString(
            'base64url',
          )
        : null,
    }
    const directRelations: ContainerDetail['directRelations'] = {
      projects: [],
      areas: [],
      goals: [],
      resources: [],
      tags: [],
      urls: [],
    }

    if (kind === 'tags' || kind === 'urls') {
      const junction = kind === 'tags' ? junctionTags : junctionUrls
      const attached = db
        .select({ id: junction.attachedToId })
        .from(junction)
        .where(eq(junction.refId, id))
        .all()
        .map((row) => row.id)
      const [projects, areas, goals, resources] = await Promise.all([
        new ProjectsRepository(this.database).getByIds(attached),
        new AreasRepository(this.database).getByIds(attached),
        new GoalsRepository(this.database).getByIds(attached),
        new ResourcesRepository(this.database).getByIds(attached),
      ])
      Object.assign(directRelations, { projects, areas, goals, resources })
    } else {
      const attachments = {
        tags: withTags,
        urls: withUrls,
        resources: withResources,
      } as const
      const direct =
        kind === 'projects'
          ? await db.query.projects.findFirst({
              columns: { id: true },
              where: eq(projects.id, id),
              with: { ...attachments, area: true, goal: true },
            })
          : kind === 'areas'
            ? await db.query.areas.findFirst({
                columns: { id: true },
                where: eq(areas.id, id),
                with: { ...attachments, projects: true, goals: true },
              })
            : await db.query.goals.findFirst({
                columns: { id: true },
                where: eq(goals.id, id),
                with: { ...attachments, area: true, projects: true },
              })

      const relations = direct ? unwrapJunctions(direct) : undefined
      if (relations) {
        directRelations.tags = relations.tags ?? []
        directRelations.urls = relations.urls ?? []
        directRelations.resources = relations.resources ?? []
        if ('projects' in relations)
          directRelations.projects = relations.projects ?? []
        if ('goals' in relations) directRelations.goals = relations.goals ?? []
        if ('area' in relations && relations.area)
          directRelations.areas = [relations.area]
        if ('goal' in relations && relations.goal)
          directRelations.goals = [relations.goal]
      }
    }
    return { item, directRelations, tasks: page }
  }
}
