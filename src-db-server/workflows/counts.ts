import { sql } from 'drizzle-orm'
import type { SyncTx } from '@d/database/repositories/helpers'
import type {
  EntityCollectionKind,
  EntitySupporterKind,
} from '@c/workflows/contracts'
import {
  areas,
  goals,
  junctionResources,
  junctionTags,
  junctionTimeEntries,
  junctionUrls,
  projects,
  resources,
  tags,
  tasks,
  timeEntries,
  urls,
} from '@d/database/schemas'

const supporterTables = {
  tags: { table: tags, junction: junctionTags },
  urls: { table: urls, junction: junctionUrls },
  time_entries: { table: timeEntries, junction: junctionTimeEntries },
} as const

const collectionTables = {
  projects: { table: projects, column: 'project_id' },
  areas: { table: areas, column: 'area_id' },
  goals: { table: goals, column: 'goal_id' },
} as const

/**
 * Recomputes `count_tasks`, `count_resources` and `count_pga` from the
 * supporter's junction table. Counts are derived rather than incremented so
 * they stay correct across replace-syncs, cascades and bulk deletes; only rows
 * whose counts actually changed are written.
 */
export function recomputeSupporterCounts(
  tx: SyncTx,
  kinds: EntitySupporterKind[] = ['tags', 'urls', 'time_entries'],
) {
  for (const kind of kinds) {
    const { table, junction } = supporterTables[kind]
    tx.run(sql`
      UPDATE ${table}
      SET count_tasks = c.tasks, count_resources = c.resources, count_pga = c.pga
      FROM (
        SELECT s.id AS id,
          count(${tasks.id}) AS tasks,
          count(${resources.id}) AS resources,
          count(${projects.id}) + count(${areas.id}) + count(${goals.id}) AS pga
        FROM ${table} AS s
        LEFT JOIN ${junction} ON ${junction.refId} = s.id
        LEFT JOIN ${tasks} ON ${tasks.id} = ${junction.attachedToId}
        LEFT JOIN ${resources} ON ${resources.id} = ${junction.attachedToId}
        LEFT JOIN ${projects} ON ${projects.id} = ${junction.attachedToId}
        LEFT JOIN ${areas} ON ${areas.id} = ${junction.attachedToId}
        LEFT JOIN ${goals} ON ${goals.id} = ${junction.attachedToId}
        GROUP BY s.id
      ) AS c
      WHERE ${table.id} = c.id
        AND (count_tasks IS NOT c.tasks
          OR count_resources IS NOT c.resources
          OR count_pga IS NOT c.pga)
    `)
  }
}

/**
 * Recomputes `count_tasks` (from task foreign keys) and `count_resources`
 * (from resource links) for collections.
 */
export function recomputeCollectionCounts(
  tx: SyncTx,
  kinds: EntityCollectionKind[] = ['projects', 'areas', 'goals'],
) {
  for (const kind of kinds) {
    const { table, column } = collectionTables[kind]
    tx.run(sql`
      UPDATE ${table}
      SET count_tasks = c.tasks, count_resources = c.resources
      FROM (
        SELECT s.id AS id,
          (SELECT count(*) FROM ${tasks} WHERE ${tasks[column]} = s.id) AS tasks,
          (SELECT count(*) FROM ${junctionResources} WHERE ${junctionResources.attachedToId} = s.id) AS resources
        FROM ${table} AS s
      ) AS c
      WHERE ${table.id} = c.id
        AND (count_tasks IS NOT c.tasks OR count_resources IS NOT c.resources)
    `)
  }
}
