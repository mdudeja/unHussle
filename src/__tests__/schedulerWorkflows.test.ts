import { getDateTimeMillis } from '@c/datetimeUtils'
import { describe, expect, test } from 'bun:test'
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
import { ProgressStatus } from '@c/types'

function fixture({ emit = true, failRefresh = false } = {}) {
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
    await f.runtime.commands.execute('occurrence.transition', {
      id: 'recurring:2026-11-02:0',
      status: ProgressStatus.COMPLETED,
    })
    expect(f.taskReads()).toBe(2)
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
