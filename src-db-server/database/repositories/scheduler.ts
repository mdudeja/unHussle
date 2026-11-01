import {
  and,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  isNotNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  getDayBoundsMillis,
  getLocalDateString,
  MINUTE_MS,
} from '@c/datetimeUtils'
import type {
  PlanEntry,
  SchedulerSettings,
  SchedulerTask,
} from '@c/scheduler/contracts'
import { addDaysToDate, parseCalendarDate } from '@c/calendarUtils'
import { ProgressStatus } from '@c/types'
import { isPending, pendingStatuses } from '@c/scheduler/status'
import { parseOccurrenceId } from '@c/scheduler/preparation'
import {
  dayPlans,
  planItems,
  schedulingOverrides,
  taskOccurrences,
  tasks,
  timeEntries,
} from '../schemas'
import { withTags, type SyncTx } from './helpers'

export type ScheduleTx = Pick<
  SyncTx,
  'query' | 'select' | 'insert' | 'update' | 'delete'
>
const pendingTasks = or(
  inArray(tasks.status, pendingStatuses),
  isNull(tasks.status),
)
// Scheduling needs collection ancestry and tags, but no URLs or time-entry history.
const taggedArea = { with: { tags: withTags } } as const
const taggedGoal = { with: { tags: withTags, area: taggedArea } } as const

const schedulerTaskRelations = {
  tags: withTags,
  area: taggedArea,
  goal: taggedGoal,
  project: { with: { tags: withTags, area: taggedArea, goal: taggedGoal } },
} as const

/** Same relation projection as task repositories, without unbounded supporter history. */
export function readSchedulerTasks(
  tx: ScheduleTx,
  settings: SchedulerSettings,
  where: SQL | undefined = pendingTasks,
): SchedulerTask[] {
  const titles = new Set(
    settings.workTags.map((tag) => tag.trim().toLowerCase()),
  )
  return tx.query.tasks
    .findMany({ where, with: schedulerTaskRelations })
    .sync()
    .map((task) => {
      const goal = task.goal ?? task.project?.goal
      const area = task.area ?? task.project?.area ?? goal?.area
      const collections = [
        task,
        task.project,
        task.goal,
        task.area,
        task.project?.goal,
        task.project?.area,
        task.goal?.area,
        task.project?.goal?.area,
      ]
      return {
        ...task,
        collectionPriorities: [
          task.project?.priority ?? null,
          goal?.priority ?? null,
          area?.priority ?? null,
        ],
        isWork: collections.some((collection) =>
          collection?.tags.some(({ tag }) =>
            titles.has(tag.title.toLowerCase()),
          ),
        ),
      }
    })
}

function dayEligibility(date: string, timezone: string) {
  const [start, end] = getDayBoundsMillis(date, timezone)
  const day = parseCalendarDate(date)
  const selector = (key: string, value: number) =>
    sql`(coalesce(json_array_length(json_extract(${tasks.recurrance_rule}, ${'$.data.' + key})), 0) = 0 or ${value} in (select value from json_each(${tasks.recurrance_rule}, ${'$.data.' + key})))`

  return and(
    pendingTasks,
    or(
      and(
        eq(tasks.is_recurring, true),
        or(isNull(tasks.scheduled_start), lt(tasks.scheduled_start, end)),
        selector('weekDays', day.dayOfWeek),
        selector('monthDays', day.day),
        selector('months', day.month),
      ),
      and(
        eq(tasks.is_recurring, false),
        or(
          eq(tasks.status, ProgressStatus.IN_PROGRESS),
          and(
            or(isNull(tasks.scheduled_start), lt(tasks.scheduled_start, end)),
            or(
              isNull(tasks.scheduled_start),
              sql`coalesce(${tasks.scheduled_end}, ${tasks.scheduled_start}) >= ${start}`,
            ),
          ),
        ),
      ),
    ),
  )
}

function readEligibleTasks(
  tx: ScheduleTx,
  settings: SchedulerSettings,
  date: string,
  timezone: string,
  where?: SQL,
) {
  return readSchedulerTasks(
    tx,
    settings,
    and(dayEligibility(date, timezone), where),
  )
}

/** Candidate eligibility is decided here; retained/dependency rows are references only. */
export function readDayTasks(
  tx: ScheduleTx,
  settings: SchedulerSettings,
  date: string,
  timezone: string,
  retained: string[] = [],
  includeBacklog = true,
) {
  const candidates = readEligibleTasks(
    tx,
    settings,
    date,
    timezone,
    includeBacklog
      ? undefined
      : or(
          isNotNull(tasks.scheduled_start),
          isNotNull(tasks.scheduled_end),
          eq(tasks.status, ProgressStatus.IN_PROGRESS),
          retained.length ? inArray(tasks.id, retained) : undefined,
        ),
  )
  const candidateIds = new Set(candidates.map((task) => task.id))
  const byId = new Map(candidates.map((task) => [task.id, task]))
  let ids = [
    ...retained,
    ...candidates.flatMap((task) => (task.anchor_id ? [task.anchor_id] : [])),
  ].filter((id) => !byId.has(id))
  while (ids.length) {
    const added = readSchedulerTasks(
      tx,
      settings,
      inArray(tasks.id, [...new Set(ids)]),
    )
    ids = []
    for (const task of added) {
      byId.set(task.id, task)
      if (task.anchor_id && !byId.has(task.anchor_id)) ids.push(task.anchor_id)
    }
  }
  return {
    candidates,
    references: [...byId.values()].filter((task) => !candidateIds.has(task.id)),
  }
}

/** Count without hydrating the backlog or historical occurrences. */
export function countDayCandidates(
  tx: ScheduleTx,
  date: string,
  timezone: string,
) {
  const slots = sql`max(1, coalesce(json_array_length(json_extract(${tasks.recurrance_rule}, '$.data.slots')), 0))`
  const ended = sql`(select count(*) from task_occurrences o where o.task_id = tasks.id and o.date = ${date} and o.status not in ('planned', 'paused', 'in_progress') and o.slot < ${slots})`
  return (
    tx
      .select({
        count: sql<number>`coalesce(sum(case when ${tasks.is_recurring} then max(0, ${slots} - ${ended}) else 1 end), 0)`,
      })
      .from(tasks)
      .where(dayEligibility(date, timezone))
      .get()?.count ?? 0
  )
}

export function validateTaskAnchors(
  tx: ScheduleTx,
  task: Pick<SchedulerTask, 'id' | 'anchor_id'>,
) {
  const visited = new Set([task.id])
  let id = task.anchor_id
  while (id) {
    if (visited.has(id)) throw new Error('Task anchors cannot contain cycles')
    visited.add(id)
    id =
      tx
        .select({ anchor: tasks.anchor_id })
        .from(tasks)
        .where(eq(tasks.id, id))
        .get()?.anchor ?? null
  }
}

/** Correlated tag lookup preserves inheritance without materializing task/tag id lists. */
function workPredicate(settings: SchedulerSettings) {
  const titles = settings.workTags.map((tag) => tag.trim().toLowerCase())
  if (!titles.length) return sql`0`
  return sql`exists (
    select 1 from junction_tags j join tags tag on tag.id = j."refId"
    where tag.title in (${sql.join(
      titles.map((title) => sql`${title}`),
      sql`, `,
    )})
    and j."attachedToId" in (
      tasks.id, tasks.project_id, tasks.goal_id, tasks.area_id,
      (select goal_id from projects where id = tasks.project_id),
      (select area_id from projects where id = tasks.project_id),
      (select area_id from goals where id = tasks.goal_id),
      (select area_id from goals where id = (select goal_id from projects where id = tasks.project_id))
    )
  )`
}

export function dailyWorkUsed(
  tx: ScheduleTx,
  settings: SchedulerSettings,
  date: string,
  timezone: string,
  now: number,
) {
  const [start, end] = getDayBoundsMillis(date, timezone)
  const overlap = sql<number>`coalesce(sum(max(0, min(coalesce(${timeEntries.end_time}, ${now}), ${end}) - max(${timeEntries.start_time}, ${start}))), 0) / (${MINUTE_MS} * 1.0)`
  return (
    tx
      .select({ minutes: overlap })
      .from(timeEntries)
      .innerJoin(tasks, eq(tasks.id, timeEntries.task_id))
      .where(
        and(
          lt(timeEntries.start_time, end),
          or(gt(timeEntries.end_time, start), isNull(timeEntries.end_time)),
          workPredicate(settings),
        ),
      )
      .get()?.minutes ?? 0
  )
}

export function readOccurrences(
  tx: ScheduleTx,
  date: string,
  today: string,
  ids: string[] = [],
) {
  return tx
    .select()
    .from(taskOccurrences)
    .where(
      or(
        eq(taskOccurrences.date, date),
        eq(taskOccurrences.status, ProgressStatus.IN_PROGRESS),
        ids.length ? inArray(taskOccurrences.id, ids) : undefined,
      ),
    )
    .all()
    .map((row) => ({
      ...row,
      // Expiry is only written by commands; reads already show it.
      status:
        row.date < today &&
        isPending(row.status) &&
        row.status !== 'in_progress'
          ? 'missed'
          : row.status,
    }))
}

/** Open tracking intervals keyed by task and occurrence. */
export function readOpenIntervals(tx: ScheduleTx) {
  return new Map(
    tx
      .select()
      .from(timeEntries)
      .where(isNull(timeEntries.end_time))
      .all()
      .map((entry) => [
        intervalKey(entry.task_id, entry.occurrence_id),
        entry,
      ]),
  )
}
export const intervalKey = (taskId: string, occurrenceId: string | null) =>
  `${taskId}|${occurrenceId ?? ''}`

export function readPlan(tx: ScheduleTx, id: string) {
  return tx.query.dayPlans
    .findFirst({
      where: eq(dayPlans.id, id),
      with: { entries: { orderBy: [planItems.position] } },
    })
    .sync()
}

/** One-off tasks reserved by deferrals or by other current and future plans. */
export function readExclusions(
  tx: ScheduleTx,
  date: string,
  timezone: string,
  today: string,
) {
  const deferred = tx
    .select({ id: schedulingOverrides.id })
    .from(schedulingOverrides)
    .where(gt(schedulingOverrides.availableDate, date))
    .all()
  const reserved = tx
    .select({ id: planItems.itemId })
    .from(planItems)
    .innerJoin(dayPlans, eq(dayPlans.id, planItems.planId))
    .where(
      and(
        isNull(planItems.occurrenceId),
        inArray(planItems.status, pendingStatuses),
        eq(dayPlans.timezone, timezone),
        ne(dayPlans.date, date),
        gte(dayPlans.date, today),
      ),
    )
    .all()
  return new Set([...deferred, ...reserved].map((row) => row.id))
}

/** Pending one-offs saved in plans between two dates, inclusive. */
export function readReservedBetween(
  tx: ScheduleTx,
  timezone: string,
  from: string,
  to: string,
) {
  return tx
    .select({ id: planItems.itemId })
    .from(planItems)
    .innerJoin(dayPlans, eq(dayPlans.id, planItems.planId))
    .where(
      and(
        isNull(planItems.occurrenceId),
        inArray(planItems.status, pendingStatuses),
        eq(dayPlans.timezone, timezone),
        gte(dayPlans.date, from),
        lte(dayPlans.date, to),
      ),
    )
    .all()
    .map((row) => row.id)
}

export function writePlan(
  tx: ScheduleTx,
  plan: {
    id: string
    date: string
    timezone: string
    revision: number
    conflicts: string[]
    entries: PlanEntry[]
  },
) {
  const { id, date, timezone, revision, conflicts } = plan
  // Occurrences are materialized when their day is saved.
  const occurrences = plan.entries.flatMap((entry) =>
    entry.occurrenceId
      ? [
          {
            id: entry.occurrenceId,
            sourceTaskId: entry.taskId,
            taskId: entry.taskId,
            ...parseOccurrenceId(entry.occurrenceId),
          },
        ]
      : [],
  )
  if (occurrences.length)
    tx.insert(taskOccurrences).values(occurrences).onConflictDoNothing().run()
  tx.insert(dayPlans)
    .values({ id, date, timezone, revision, stale: false, conflicts })
    .onConflictDoUpdate({
      target: dayPlans.id,
      set: { revision, stale: false, conflicts },
    })
    .run()
  tx.delete(planItems).where(eq(planItems.planId, id)).run()
  if (!plan.entries.length) return
  // Deleted tasks keep their history rows, without a live task reference.
  const live = new Set(
    tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        inArray(
          tasks.id,
          plan.entries.map((entry) => entry.taskId),
        ),
      )
      .all()
      .map((row) => row.id),
  )
  tx.insert(planItems)
    .values(
      plan.entries.map((entry, position) => ({
        id: `${id}:${entry.id}`,
        planId: id,
        itemId: entry.id,
        sourceTaskId: entry.taskId,
        taskId: live.has(entry.taskId) ? entry.taskId : null,
        occurrenceId: entry.occurrenceId,
        position,
        status: entry.status,
        pinned: entry.pinned,
        reason: entry.reason,
      })),
    )
    .run()
}

/** Bumps the revision of plans whose saved stack changed underneath them. */
export function bumpRevisions(tx: ScheduleTx, planIds: Iterable<string>) {
  const ids = [...new Set(planIds)]
  if (ids.length)
    tx.update(dayPlans)
      .set({ revision: sql`${dayPlans.revision} + 1` })
      .where(inArray(dayPlans.id, ids))
      .run()
}

/** A one-off belongs to one day: saving it migrates earlier memberships. */
export function migrateEarlierMemberships(
  tx: ScheduleTx,
  date: string,
  taskIds: string[],
) {
  if (!taskIds.length) return
  const rows = tx
    .select({ id: planItems.id, planId: planItems.planId })
    .from(planItems)
    .where(
      and(
        inArray(planItems.sourceTaskId, taskIds),
        isNull(planItems.occurrenceId),
        inArray(planItems.status, pendingStatuses),
        inArray(
          planItems.planId,
          tx
            .select({ id: dayPlans.id })
            .from(dayPlans)
            .where(lt(dayPlans.date, date)),
        ),
      ),
    )
    .all()
  if (!rows.length) return
  tx.update(planItems)
    .set({ status: ProgressStatus.MIGRATED })
    .where(
      inArray(
        planItems.id,
        rows.map((row) => row.id),
      ),
    )
    .run()
  bumpRevisions(
    tx,
    rows.map((row) => row.planId),
  )
}

export function expireOccurrences(tx: ScheduleTx, today: string) {
  tx.update(taskOccurrences)
    .set({ status: 'missed' })
    .where(
      and(
        lt(taskOccurrences.date, today),
        inArray(taskOccurrences.status, [
          ProgressStatus.PLANNED,
          ProgressStatus.PAUSED,
        ]),
      ),
    )
    .run()
}

/**
 * Marks current and future plans for review. Plans carry their own timezone,
 * so the bound starts a day before UTC today to cover every local today.
 */
export function markPlansStale(tx: ScheduleTx, now: number) {
  tx.update(dayPlans)
    .set({ stale: true })
    .where(
      and(
        eq(dayPlans.stale, false),
        gte(dayPlans.date, addDaysToDate(getLocalDateString(now, 'UTC'), -1)),
      ),
    )
    .run()
}
