import { describe, expect, test } from 'bun:test'
import {
  createResourceAutosave,
  type AutosaveState,
} from '@/lib/resourceAutosave'

class Conflict extends Error {}

/** Manual timers and a save whose calls resolve when the test says so. */
function fixture() {
  const timers: (() => void)[] = []
  const calls: {
    content: string
    baseHash: string | null
    force: boolean
    resolve: () => void
    reject: (error: unknown) => void
  }[] = []
  const states: AutosaveState[] = []
  const autosave = createResourceAutosave({
    baseHash: 'h0',
    save: (content, baseHash, force) =>
      new Promise((resolve, reject) => {
        calls.push({
          content,
          baseHash,
          force,
          resolve: () => resolve({ content_hash: `hash:${content}` }),
          reject,
        })
      }),
    isConflict: (error) => error instanceof Conflict,
    onChange: (state) => states.push(state),
    setTimer: (run) => {
      timers.push(run)
      return timers.length - 1
    },
    clearTimer: (timer) => {
      timers[timer as number] = () => {}
    },
  })
  const tick = () => timers.splice(0).forEach((run) => run())
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
  return { autosave, calls, states, tick, settle }
}

describe('resource autosave', () => {
  test('debounces edits into one save of the newest content', async () => {
    const f = fixture()
    f.autosave.edit('a')
    f.autosave.edit('ab')
    expect(f.autosave.state.status).toBe('dirty')
    f.tick()
    expect(f.calls.map((call) => call.content)).toEqual(['ab'])
    expect(f.calls[0].baseHash).toBe('h0')
    f.calls[0].resolve()
    await f.settle()
    expect(f.autosave.state).toEqual({
      status: 'saved',
      baseHash: 'hash:ab',
      error: undefined,
    })
  })

  test('keeps one save in flight and sends edits made meanwhile after it', async () => {
    const f = fixture()
    f.autosave.edit('one')
    f.tick()
    f.autosave.edit('two')
    f.autosave.edit('three')
    const flushed = f.autosave.flush()
    expect(f.calls).toHaveLength(1)
    f.calls[0].resolve()
    await f.settle()
    expect(f.calls.map((call) => call.content)).toEqual(['one', 'three'])
    // The second save builds on the first one's hash.
    expect(f.calls[1].baseHash).toBe('hash:one')
    f.calls[1].resolve()
    await flushed
    expect(f.autosave.state.status).toBe('saved')
    expect(f.autosave.hasUnsaved).toBe(false)
  })

  test('a conflict stops saving until the user overwrites', async () => {
    const f = fixture()
    f.autosave.edit('mine')
    f.tick()
    f.calls[0].reject(new Conflict())
    await f.settle()
    expect(f.autosave.state.status).toBe('conflict')

    f.autosave.edit('mine, more')
    f.tick()
    await f.autosave.flush()
    expect(f.calls).toHaveLength(1)

    const overwritten = f.autosave.overwrite()
    expect(f.calls[1]).toMatchObject({ content: 'mine, more', force: true })
    f.calls[1].resolve()
    await overwritten
    expect(f.autosave.state.status).toBe('saved')
  })

  test('reloading drops unsaved edits and takes the new base', async () => {
    const f = fixture()
    f.autosave.edit('stale')
    f.autosave.reset('disk-hash')
    f.tick()
    expect(f.calls).toEqual([])
    expect(f.autosave.state).toMatchObject({
      status: 'idle',
      baseHash: 'disk-hash',
    })
  })

  test('an error keeps the text for a retry', async () => {
    const f = fixture()
    f.autosave.edit('draft')
    f.tick()
    f.calls[0].reject(new Error('offline'))
    await f.settle()
    expect(f.autosave.state).toMatchObject({
      status: 'error',
      error: 'offline',
    })
    expect(f.autosave.hasUnsaved).toBe(true)
    const retried = f.autosave.retry()
    expect(f.calls[1].content).toBe('draft')
    f.calls[1].resolve()
    await retried
    expect(f.autosave.state.status).toBe('saved')
  })
})
