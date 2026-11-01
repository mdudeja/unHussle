import { eq } from 'drizzle-orm'
import { anchorViolations } from '@c/scheduler/anchors'
import { isPending } from '@c/scheduler/status'
import { validateSettings } from '@c/scheduler/validation'
import { getLocalDateString } from '@c/datetimeUtils'
import { addDaysToDate, parseCalendarDate } from '@c/calendarUtils'
import { ProgressStatus } from '@c/types'
import type {
  DayPlan,
  SchedulerCommands,
  SchedulerSettings,
} from '@c/scheduler/contracts'
import {
  type ScheduleTx,
  expireOccurrences,
  markPlansStale,
  migrateEarlierMemberships,
  writePlan,
} from '@d/database/repositories/scheduler'
import {
  schedulerSettings,
  schedulingOverrides,
  taskOccurrences,
  tasks,
} from '@d/database/schemas'
import { trackInterval } from './tracking'
import {
  ScheduleConflict,
  composeDay,
  planId,
  previewWeek,
  readDay,
} from './scheduler'

export type SchedulerCommand = keyof SchedulerCommands
type Request = {
  [K in SchedulerCommand]: { command: K; input: SchedulerCommands[K]['input'] }
}[SchedulerCommand]
type DayRequest = Extract<
  Request,
  { command: 'scheduler.generate' | 'scheduler.replan' | 'scheduler.adjust' }
>

/** Carried from action to action within one scheduler command. */
export type SchedulerState = Request & {
  now: number
  settings: SchedulerSettings
  today?: string
  previous?: DayPlan
  plan?: DayPlan
  result?: SchedulerCommands[SchedulerCommand]['result']
  /** Set by an action that has produced the final result early. */
  done?: boolean
}

export type SchedulerActionName =
  | 'expireOccurrences'
  | 'loadPlan'
  | 'checkRevision'
  | 'keepSaved'
  | 'buildPlan'
  | 'adjustPlan'
  | 'checkAnchors'
  | 'savePlan'
  | 'saveSettings'
  | 'transitionOccurrence'
  | 'trackOccurrenceInterval'

/** Synchronous; runs inside the command's transaction. */
export type SchedulerAction = (
  name: SchedulerActionName,
  state: SchedulerState,
  work: { tx: ScheduleTx },
) => void

const staleRevision = () =>
  new ScheduleConflict('The plan changed. Refresh before editing it again.')

function dayRequest(state: SchedulerState): DayRequest['input'] {
  if (
    state.command === 'scheduler.settings.change' ||
    state.command === 'occurrence.transition'
  )
    throw new Error(`${state.command} does not plan a day`)
  return state.input
}

function loaded(state: SchedulerState) {
  if (!state.previous || !state.today)
    throw new Error('loadPlan must run before this action')
  return { previous: state.previous, today: state.today }
}

export const schedulerActions: { [K in SchedulerActionName]?: SchedulerAction } =
  {
    expireOccurrences: (_name, state, { tx }) => {
      const { timezone } = dayRequest(state)
      // A bounded-index update, never a history read.
      expireOccurrences(tx, getLocalDateString(state.now, timezone))
    },

    loadPlan: (_name, state, { tx }) => {
      const { date, timezone } = dayRequest(state)
      state.today = getLocalDateString(state.now, timezone)
      state.previous = readDay(tx, date, timezone, state.now, [], state.settings)
    },

    checkRevision: (_name, state) => {
      const { revision } = dayRequest(state)
      if (revision !== undefined && loaded(state).previous.revision !== revision)
        throw staleRevision()
    },

    // Generation is idempotent: a saved day is returned as it is.
    keepSaved: (_name, state) => {
      const { previous } = loaded(state)
      if (!previous.saved) return
      state.result = previous
      state.done = true
    },

    buildPlan: (_name, state, { tx }) => {
      const { date, timezone } = dayRequest(state)
      const { previous, today } = loaded(state)
      const cue = state.command === 'scheduler.replan' ? state.input.cue : 'fresh'
      // Unsaved days this week follow the preview, so saving keeps its allocation.
      const plan =
        !previous.saved && date > today && date <= addDaysToDate(today, 6)
          ? previewWeek(tx, today, timezone, state.now, date).pop()
          : undefined
      const built =
        plan ??
        composeDay(tx, {
          settings: state.settings,
          date,
          timezone,
          now: state.now,
          today,
          previous: previous.saved ? previous : undefined,
          cue,
        })
      // Finished entries stay in the day's history across replans.
      const placed = new Set(built.entries.map((entry) => entry.id))
      state.plan = {
        ...built,
        entries: [
          ...previous.entries.filter(
            (entry) => !isPending(entry.status) && !placed.has(entry.id),
          ),
          ...built.entries,
        ],
      }
    },

    adjustPlan: (_name, state, { tx }) => {
      if (state.command !== 'scheduler.adjust')
        throw new Error('adjustPlan only handles scheduler.adjust')
      const { date, itemId, action, position, until } = state.input
      const { previous } = loaded(state)
      if (!previous.saved) throw new Error('Save the day before editing it')
      const entries = [...previous.entries]
      const index = entries.findIndex((entry) => entry.id === itemId)
      if (index < 0) throw new Error('Task is no longer in this stack')
      const entry = { ...entries[index] }
      if (entry.status === 'in_progress')
        throw new Error('Pause the current task before moving it')
      entries.splice(index, 1)
      if (action === 'pin') {
        entry.pinned = !entry.pinned
        entries.splice(index, 0, entry)
      } else if (action === 'defer') {
        if (!until || until <= date) throw new Error('Choose a later date')
        parseCalendarDate(until)
        if (entry.fixedStart !== null)
          throw new Error('Edit the appointment time to move it')
        if (entry.occurrenceId)
          tx.update(taskOccurrences)
            .set({ status: ProgressStatus.SKIPPED })
            .where(eq(taskOccurrences.id, entry.occurrenceId))
            .run()
        else
          tx.insert(schedulingOverrides)
            .values({ id: entry.taskId, availableDate: until })
            .onConflictDoUpdate({
              target: schedulingOverrides.id,
              set: { availableDate: until },
            })
            .run()
      } else {
        entries.splice(
          action === 'later'
            ? entries.length
            : Math.max(0, Math.min(position ?? 0, entries.length)),
          0,
          entry,
        )
      }
      state.plan = { ...previous, entries }
    },

    checkAnchors: (_name, state) => {
      const [violation] = anchorViolations(state.plan?.entries ?? [])
      if (violation) throw new Error(violation)
    },

    savePlan: (_name, state, { tx }) => {
      const { date, timezone } = dayRequest(state)
      const { previous } = loaded(state)
      if (!state.plan) throw new Error('No plan to save')
      const revision = previous.revision + 1
      writePlan(tx, {
        id: planId(date, timezone),
        date,
        timezone,
        revision,
        conflicts: state.plan.conflicts,
        entries: state.plan.entries,
      })
      migrateEarlierMemberships(
        tx,
        date,
        state.plan.entries
          .filter((entry) => !entry.occurrenceId && isPending(entry.status))
          .map((entry) => entry.taskId),
      )
      state.result = { ...state.plan, revision, saved: true, stale: false }
    },

    saveSettings: (_name, state, { tx }) => {
      if (state.command !== 'scheduler.settings.change')
        throw new Error('saveSettings only handles settings changes')
      const { settings } = state.input
      validateSettings(settings)
      tx.insert(schedulerSettings)
        .values({ id: 'default', settings })
        .onConflictDoUpdate({ target: schedulerSettings.id, set: { settings } })
        .run()
      markPlansStale(tx, state.now)
      state.settings = settings
      state.result = settings
    },

    transitionOccurrence: (_name, state, { tx }) => {
      if (state.command !== 'occurrence.transition')
        throw new Error('transitionOccurrence only handles occurrences')
      const { id, status } = state.input
      const occurrence = tx
        .select()
        .from(taskOccurrences)
        .where(eq(taskOccurrences.id, id))
        .get()
      if (!occurrence?.taskId)
        throw new Error('Occurrence not found; save its day first')
      const task = tx
        .select({ recurring: tasks.is_recurring, status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, occurrence.taskId))
        .get()
      if (!task?.recurring || !isPending(task.status ?? ProgressStatus.PLANNED))
        throw new Error('This recurring task is no longer active')
      if (status === ProgressStatus.IN_PROGRESS && !isPending(occurrence.status))
        throw new Error('This occurrence has already ended')
      tx.update(taskOccurrences)
        .set({ status })
        .where(eq(taskOccurrences.id, id))
        .run()
    },

    trackOccurrenceInterval: (_name, state, { tx }) => {
      if (state.command !== 'occurrence.transition')
        throw new Error('trackOccurrenceInterval only handles occurrences')
      const { id, status } = state.input
      const occurrence = tx
        .select()
        .from(taskOccurrences)
        .where(eq(taskOccurrences.id, id))
        .get()
      if (!occurrence?.taskId) return
      trackInterval(tx, occurrence.taskId, id, status, state.now)
      state.result = tx
        .select()
        .from(taskOccurrences)
        .where(eq(taskOccurrences.id, id))
        .get()
    },
  }
