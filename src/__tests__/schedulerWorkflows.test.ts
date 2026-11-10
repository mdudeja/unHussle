import type { EntryKind } from '@c/workflows/contracts'
import type { EntryTransport } from '@/workflows/contracts'
import { getDateTimeMillis } from '@c/datetimeUtils'
import { describe, expect, mock, test } from 'bun:test'
import { createStore } from 'zustand/vanilla'
import { useStore, type StoreState } from '@/store'
import { createFrontendRuntime } from '@/workflows/runtime'
import type { EventHandlers } from '@/workflows/eventStream'
import type { SchedulerTransport } from '@/services/scheduler'
import type { SchedulerCommands, DayPlan } from '@c/scheduler/contracts'
import { buildDay } from '@c/scheduler/engine'
import {
  defaultSchedulerSettings,
  schedulerCommandEvents,
} from '@c/scheduler/contracts'
import { createTelemetry } from '@c/workflows/telemetry'
import { ProgressStatus } from '@c/types/enums'
import { type TimeEntry } from '@c/types'
import { overnightStart, suggestedStop } from '@/workflows/schedulerHooks'

/** Creates a reusable test fixture for exercising scheduler frontend runtime behavior, including mock data services, query activation, command handling, failure modes, event delivery, and teardown. */
function fixture({
  emit = true,
  failRefresh = false,
  failWrite = false,
  keepRunning = false,
  failTimerRead = false,
} = {}) {
  let taskStatus = ProgressStatus.IN_PROGRESS
  const updateTask = mock(async () => {
    throw new Error('Frontend must not pause tasks')
  })
  const taskService: EntryTransport = {
    create: updateTask,
    update: updateTask,
    delete: updateTask,
    reset: updateTask,
    search: async () => [],
    fetchPaginated: async () => [],
    fetchById: async (id) => {
      if (failTimerRead) throw new Error('Timer read unavailable')
      return { id, status: taskStatus }
    },
  }
  const services = Object.fromEntries(
    [
      'tasks',
      'projects',
      'areas',
      'goals',
      'resources',
      'tags',
      'urls',
      'time_entries',
    ].map((kind) => [kind, taskService]),
  ) as Record<EntryKind, EntryTransport>
  let handlers: EventHandlers | undefined
  let writes = 0
  let reads = 0
  let shouldFail = failRefresh
  let plan: DayPlan = {
    ...buildDay({
      candidates: [],
      date: '2026-11-02',
      timezone: 'UTC',
      now: getDateTimeMillis('2026-11-02', '07:00', 'UTC'),
      settings: defaultSchedulerSettings,
    }),
    saved: true,
    revision: 1,
  }
  const scheduler: SchedulerTransport = {
    day: async () => {
      reads++
      if (shouldFail && writes) throw new Error('read unavailable')
      return plan
    },
    week: async () => [plan],
    settings: async () => defaultSchedulerSettings,
    execute: async <K extends keyof SchedulerCommands>(
      name: K,
      _input: SchedulerCommands[K]['input'],
      options: { operationId?: string },
    ): Promise<SchedulerCommands[K]['result']> => {
      writes++
      if (failWrite) throw new Error('Scheduler rejected')
      if (
        !keepRunning &&
        (name === 'scheduler.tracking.stop' ||
          name === 'scheduler.occurrence.transition' ||
          name === 'scheduler.mode.change')
      )
        taskStatus = ProgressStatus.PAUSED
      plan = { ...plan, revision: plan.revision + 1 }
      if (emit)
        setTimeout(() => {
          void handlers?.onEvent(schedulerCommandEvents[name], {
            operationId: options.operationId,
          })
        }, 0)
      return plan
    },
  }
  const runtime = createFrontendRuntime(
    createStore<StoreState>(() => useStore.getInitialState()),
    {
      scheduler,
      services,
      eventTimeoutMs: 5,
      transport: {
        connect: (next) => {
          handlers = next
        },
        ready: () => Promise.resolve(),
        close: () => {
          handlers = undefined
        },
      },
      telemetry: createTelemetry({ side: 'frontend' }),
    },
  )
  const key = 'schedule:day:UTC:2026-11-02'
  runtime.queries.define({
    key,
    dependencies: ['schedule'],
    load: () => scheduler.day('2026-11-02', 'UTC'),
  })
  // A task list query: plan edits must not reload it.
  let taskReads = 0
  runtime.queries.define({
    key: 'tasks:test',
    dependencies: ['tasks'],
    load: () => {
      taskReads++
      return Promise.resolve([])
    },
  })
  const deactivate = runtime.queries.activate(key)
  const deactivateTasks = runtime.queries.activate('tasks:test')
  return {
    updateTask,
    recoverTimer: () => {
      failTimerRead = false
    },
    taskReads: () => taskReads,
    runtime,
    key,
    writes: () => writes,
    reads: () => reads,
    recover: () => {
      shouldFail = false
    },
    resync: () => handlers?.onResync(),
    dispose: () => {
      deactivate()
      deactivateTasks()
      runtime.dispose()
    },
  }
}

describe('Scheduler frontend workflows', () => {
  test('a committed scheduler command settles after its event refreshes the active query', async () => {
    const f = fixture()
    await f.runtime.queries.ensure(f.key)
    await f.runtime.commands.execute('scheduler.replan', {
      date: '2026-11-02',
      timezone: 'UTC',
      revision: 1,
    })
    expect(f.runtime.queries.snapshot<DayPlan>(f.key).data?.revision).toBe(2)
    expect(f.writes()).toBe(1)
    f.dispose()
  })
  test('lost events recover through a read and never repeat generation', async () => {
    const f = fixture({ emit: false })
    await f.runtime.queries.ensure(f.key)
    await f.runtime.commands.execute('scheduler.generate', {
      date: '2026-11-02',
      timezone: 'UTC',
    })
    expect(f.writes()).toBe(1)
    expect(f.reads()).toBe(2)
    expect(f.runtime.queries.snapshot<DayPlan>(f.key).data?.revision).toBe(2)
    f.dispose()
  })
  test('post-commit refresh failure warns and Retry only repeats the read', async () => {
    const f = fixture({ failRefresh: true })
    await f.runtime.queries.ensure(f.key)
    await f.runtime.commands.execute('scheduler.replan', {
      date: '2026-11-02',
      timezone: 'UTC',
    })
    const warning = f.runtime.ui.getState().warnings[0]
    expect(warning).toBeDefined()
    f.recover()
    await warning.retry()
    expect(f.writes()).toBe(1)
    expect(f.runtime.ui.getState().warnings).toEqual([])
    expect(f.runtime.queries.snapshot<DayPlan>(f.key).data?.revision).toBe(2)
    f.dispose()
  })
  test('plan edits refresh the plan only; occurrence changes also refresh tasks', async () => {
    const f = fixture()
    await f.runtime.queries.ensure(f.key)
    await f.runtime.queries.ensure('tasks:test')
    await f.runtime.commands.execute('scheduler.replan', {
      date: '2026-11-02',
      timezone: 'UTC',
    })
    expect(f.taskReads()).toBe(1)
    await f.runtime.commands.execute('scheduler.occurrence.transition', {
      id: 'recurring:2026-11-02:0',
      status: ProgressStatus.COMPLETED,
    })
    expect(f.taskReads()).toBe(2)
    f.dispose()
  })
  test('day mode changes refresh the plan and tasks, since a break pauses work', async () => {
    const f = fixture()
    await f.runtime.queries.ensure(f.key)
    await f.runtime.queries.ensure('tasks:test')
    await f.runtime.commands.execute('scheduler.mode.change', {
      date: '2026-11-02',
      timezone: 'UTC',
      change: 'startBreak',
    })
    expect(f.taskReads()).toBe(2)
    expect(f.runtime.queries.snapshot<DayPlan>(f.key).data?.revision).toBe(2)
    f.dispose()
  })
  test('stopping a running interval at a past time ends the local tracking session', async () => {
    const f = fixture()
    f.runtime.tracking.start('essay', 1)
    await f.runtime.commands.execute('scheduler.tracking.stop', {
      taskId: 'essay',
      occurrenceId: null,
      at: 2,
    })
    expect(f.runtime.tracking.getActiveTracking()).toBeNull()
    f.dispose()
  })
  test.each(['occurrence', 'break'] as const)(
    'a failed %s start preserves the running session without a preliminary write',
    async (target) => {
      const f = fixture({ failWrite: true })
      f.runtime.tracking.start('essay', 1)
      const command =
        target === 'occurrence'
          ? f.runtime.commands.execute('scheduler.occurrence.transition', {
              id: 'missing',
              status: ProgressStatus.IN_PROGRESS,
            })
          : f.runtime.commands.execute('scheduler.mode.change', {
              date: '2026-11-02',
              timezone: 'UTC',
              change: 'startBreak',
            })
      await expect(command).rejects.toThrow('Scheduler rejected')
      expect(f.updateTask).toHaveBeenCalledTimes(0)
      expect(f.runtime.tracking.getActiveTracking()?.taskId).toBe('essay')
      f.dispose()
    },
  )
  test('a no-op break request retains a task that the backend says is still running', async () => {
    const f = fixture({ keepRunning: true })
    f.runtime.tracking.start('essay', 1)
    await f.runtime.commands.execute('scheduler.mode.change', {
      date: '2026-11-02',
      timezone: 'UTC',
      change: 'startBreak',
    })
    expect(f.updateTask).toHaveBeenCalledTimes(0)
    expect(f.runtime.tracking.getActiveTracking()?.taskId).toBe('essay')
    f.dispose()
  })
  test('missing occurrence-start events still reconcile the timer after the committed write', async () => {
    const f = fixture({ emit: false })
    f.runtime.tracking.start('essay', 1)
    await f.runtime.commands.execute('scheduler.occurrence.transition', {
      id: 'recurring:2026-11-02:0',
      status: ProgressStatus.IN_PROGRESS,
    })
    expect(f.updateTask).toHaveBeenCalledTimes(0)
    expect(f.runtime.tracking.getActiveTracking()).toBeNull()
    f.dispose()
  })
  test('timer refresh failure warns and retry reads without repeating the committed command', async () => {
    const f = fixture({ failTimerRead: true })
    f.runtime.tracking.start('essay', 1)
    await f.runtime.commands.execute('scheduler.mode.change', {
      date: '2026-11-02',
      timezone: 'UTC',
      change: 'startBreak',
    })
    expect(f.runtime.tracking.getActiveTracking()?.taskId).toBe('essay')
    const warning = f.runtime.ui.getState().warnings[0]
    expect(warning.message).toContain('timer')
    f.recoverTimer()
    await warning.retry()
    expect(f.runtime.tracking.getActiveTracking()).toBeNull()
    expect(f.runtime.ui.getState().warnings).toEqual([])
    expect(f.writes()).toBe(1)
    expect(f.updateTask).toHaveBeenCalledTimes(0)
    f.dispose()
  })
  test('stream resync reloads a saved plan without generating a new one', async () => {
    const f = fixture()
    await f.runtime.queries.ensure(f.key)
    await f.resync()
    expect(f.reads()).toBe(2)
    expect(f.writes()).toBe(0)
    f.dispose()
  })
})

describe('Work running since an earlier day', () => {
  /** Gets the millisecond timestamp for a given day and time in UTC. */
  const at = (day: string, time: string) => getDateTimeMillis(day, time, 'UTC')
  /** Creates a new time entry with default values, optionally customized by the provided changes. */
  const entry = (
    start_time: number,
    changes: Partial<TimeEntry['Read']> = {},
  ): TimeEntry['Read'] => ({
    id: 'entry',
    title: '',
    description: null,
    task_id: 'essay',
    occurrence_id: null,
    start_time,
    end_time: null,
    duration: null,
    count_tasks: 0,
    count_resources: 0,
    count_pga: 0,
    created_at: 0,
    updated_at: 0,
    ...changes,
  })
  /** Creates an in-progress essay record with an initial time entry. */
  const running = (
    start: number,
    changes: Partial<TimeEntry['Read']> = {},
  ) => ({
    id: 'essay',
    status: ProgressStatus.IN_PROGRESS,
    timeEntries: [entry(start, changes)],
  })
  const morning = at('2026-11-03', '07:00')

  test('asks only for an open one-off interval that started on an earlier day', () => {
    const yesterday = at('2026-11-02', '21:40')
    expect(overnightStart(running(yesterday), morning, 'UTC')).toBe(yesterday)
    expect(
      overnightStart(running(at('2026-11-03', '06:00')), morning, 'UTC'),
    ).toBeUndefined()
    expect(
      overnightStart(running(yesterday, { end_time: morning }), morning, 'UTC'),
    ).toBeUndefined()
    expect(
      overnightStart(
        { ...running(yesterday), status: ProgressStatus.PAUSED },
        morning,
        'UTC',
      ),
    ).toBeUndefined()
  })

  test('suggests the start day’s wind-down, or the start when it came later', () => {
    const settings = { ...defaultSchedulerSettings, overrides: {} }
    expect(suggestedStop(at('2026-11-02', '21:40'), 'UTC', settings)).toBe(
      at('2026-11-02', '23:00'),
    )
    expect(suggestedStop(at('2026-11-02', '23:30'), 'UTC', settings)).toBe(
      at('2026-11-02', '23:30'),
    )
  })
})
