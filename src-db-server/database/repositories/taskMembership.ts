import { count, eq, inArray, or, type SQL } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import type * as schema from '@d/database/schemas'
import {
  areas,
  goals,
  projects,
  tasks,
  junctionTags,
  junctionUrls,
} from '@d/database/schemas'
import type { EntityCollectionKind } from '@c/workflows/contracts'
import type { Task } from '@c/types'

type MembershipDb = Pick<BunSQLiteDatabase<typeof schema>, 'select'>
export type TaskContainer = {
  kind: EntityCollectionKind | 'tags' | 'urls'
  id: string
}
type PredicateContainer = Omit<TaskContainer, 'id'> & {
  id: string | AnySQLiteColumn
}

/** Fixed containment hierarchy only. This deliberately does not walk resource backlinks. */
export function taskMembershipPredicate(
  db: MembershipDb,
  { kind, id }: PredicateContainer,
): SQL {
  const goalsInArea = () =>
    db.select({ id: goals.id }).from(goals).where(eq(goals.area_id, id))

  switch (kind) {
    case 'projects':
      return eq(tasks.project_id, id)
    case 'goals':
      return or(
        eq(tasks.goal_id, id),
        inArray(
          tasks.project_id,
          db
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.goal_id, id)),
        ),
      )!
    case 'areas':
      return or(
        eq(tasks.area_id, id),
        inArray(tasks.goal_id, goalsInArea()),
        inArray(
          tasks.project_id,
          db
            .select({ id: projects.id })
            .from(projects)
            .where(
              or(
                eq(projects.area_id, id),
                inArray(projects.goal_id, goalsInArea()),
              ),
            ),
        ),
      )!
    case 'tags':
    case 'urls': {
      const junction = kind === 'tags' ? junctionTags : junctionUrls
      const attached = () =>
        db
          .select({ id: junction.attachedToId })
          .from(junction)
          .where(eq(junction.refId, id))
      const attachedGoals = () =>
        db
          .select({ id: goals.id })
          .from(goals)
          .where(
            or(
              inArray(goals.id, attached()),
              inArray(goals.area_id, attached()),
            ),
          )
      const attachedProjects = db
        .select({ id: projects.id })
        .from(projects)
        .where(
          or(
            inArray(projects.id, attached()),
            inArray(projects.area_id, attached()),
            inArray(projects.goal_id, attachedGoals()),
          ),
        )
      return or(
        inArray(tasks.id, attached()),
        inArray(tasks.area_id, attached()),
        inArray(tasks.goal_id, attachedGoals()),
        inArray(tasks.project_id, attachedProjects),
      )!
    }
  }
}

/** Both hydrated retrieval and totals use precisely the same membership predicate. */
export const taskMembershipIds = (db: MembershipDb, container: TaskContainer) =>
  db
    .select({ id: tasks.id })
    .from(tasks)
    .where(taskMembershipPredicate(db, container))

export function countTaskMembership(
  db: MembershipDb,
  container: TaskContainer,
): number {
  return (
    db
      .select({ total: count() })
      .from(tasks)
      .where(taskMembershipPredicate(db, container))
      .get()?.total ?? 0
  )
}

/** Resolve a page of containers in one query; nested editable relations remain direct-only. */
export function withCollectionTasks<T extends { id: string }>(
  db: MembershipDb,
  kind: EntityCollectionKind,
  rows: T[],
) {
  if (!rows.length) return []
  const table = { projects, goals, areas }[kind]
  const members = db
    .select({ ownerId: table.id, task: tasks })
    .from(table)
    .innerJoin(tasks, taskMembershipPredicate(db, { kind, id: table.id }))
    .where(
      inArray(
        table.id,
        rows.map((row) => row.id),
      ),
    )
    .all()
  const byOwner = new Map<string, Task['Read'][]>()
  for (const { ownerId, task } of members) {
    const own = byOwner.get(ownerId) ?? []
    own.push(task)
    byOwner.set(ownerId, own)
  }
  return rows.map((row) => {
    const tasks = byOwner.get(row.id) ?? []
    return { ...row, tasks, resolved_task_total: tasks.length }
  })
}
