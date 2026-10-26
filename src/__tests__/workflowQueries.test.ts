import { describe, expect, mock, test } from 'bun:test'
import { createQueryCoordinator } from '@/workflows/queries'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('Workflow queries', () => {
  test('deduplicates requests and caches successful empty results', async () => {
    const queries = createQueryCoordinator()
    const response = deferred<string[]>()
    const load = mock(() => response.promise)
    queries.define({ key: 'tasks', dependencies: ['tasks'], load })
    const first = queries.ensure('tasks')
    const second = queries.ensure('tasks')
    expect(load).toHaveBeenCalledTimes(1)
    response.resolve([])
    expect(await first).toEqual([])
    expect(await second).toEqual([])
    await queries.ensure('tasks')
    expect(load).toHaveBeenCalledTimes(1)
    expect(queries.snapshot('tasks').stale).toBe(false)
    queries.dispose()
  })

  test('only active dependent queries refresh; inactive ones reload on demand', async () => {
    const queries = createQueryCoordinator()
    const active = mock(async () => ['active'])
    const inactive = mock(async () => ['inactive'])
    const unrelated = mock(async () => ['unrelated'])
    queries.define({ key: 'active', dependencies: ['tasks'], load: active })
    queries.define({ key: 'inactive', dependencies: ['tasks'], load: inactive })
    queries.define({
      key: 'unrelated',
      dependencies: ['urls'],
      load: unrelated,
    })
    const deactivate = queries.activate('active')
    await Promise.all(
      ['active', 'inactive', 'unrelated'].map((key) => queries.ensure(key)),
    )
    await queries.invalidate(['tasks'])
    expect(active).toHaveBeenCalledTimes(2)
    expect(inactive).toHaveBeenCalledTimes(1)
    expect(unrelated).toHaveBeenCalledTimes(1)
    expect(queries.snapshot('inactive').stale).toBe(true)
    await queries.ensure('inactive')
    expect(inactive).toHaveBeenCalledTimes(2)
    deactivate()
    queries.dispose()
  })

  test('invalidation during a request discards its response and loads fresh data', async () => {
    const queries = createQueryCoordinator()
    const old = deferred<string[]>()
    const fresh = deferred<string[]>()
    const load = mock(() => old.promise)
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => fresh.promise)
    const projected: string[][] = []
    queries.define({
      key: 'tasks',
      dependencies: ['tasks'],
      load,
      onData: (data) => {
        projected.push(data)
      },
    })
    queries.activate('tasks')
    const pending = queries.ensure('tasks')
    const refresh = queries.invalidate(['tasks'])
    old.resolve(['obsolete'])
    await Promise.resolve()
    fresh.resolve(['fresh'])
    expect(await pending).toEqual(['fresh'])
    await refresh
    expect(projected).toEqual([['fresh']])
    expect(load).toHaveBeenCalledTimes(2)
    queries.dispose()
  })

  test('refresh failure retains data, remains stale, and can be retried', async () => {
    const queries = createQueryCoordinator()
    let fails = false
    queries.define({
      key: 'tasks',
      dependencies: ['tasks'],
      load: async () => {
        if (fails) throw new Error('Offline')
        return ['saved']
      },
    })
    queries.activate('tasks')
    await queries.ensure('tasks')
    fails = true
    expect((await queries.invalidate(['tasks']))[0].error).toBeInstanceOf(Error)
    expect(queries.snapshot('tasks')).toMatchObject({
      data: ['saved'],
      stale: true,
      isLoading: false,
    })
    fails = false
    expect(await queries.ensure('tasks')).toEqual(['saved'])
    queries.dispose()
  })

  test('disposal prevents in-flight responses from updating projections', async () => {
    const queries = createQueryCoordinator()
    const response = deferred<string[]>()
    const onData = mock(() => {})
    queries.define({
      key: 'tasks',
      dependencies: ['tasks'],
      load: () => response.promise,
      onData,
    })
    const pending = queries.ensure('tasks')
    queries.dispose()
    response.resolve(['old'])
    await pending
    expect(onData).not.toHaveBeenCalled()
    expect(queries.store.getState().entries).toEqual({})
  })
})
