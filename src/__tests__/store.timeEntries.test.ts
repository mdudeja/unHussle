import { readList } from '@c/testing/frontendReads'
import {
  describe,
  test,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from 'bun:test'
import { useStore } from '@/store'
import { getNowMillis } from '@c/datetimeUtils'

describe('Time Entries Store', () => {
  beforeAll(async () => {
    // create a task to associate with time entries
    const { add } = useStore.getState().tasks
    await add({
      id: 'task-1',
      title: 'Test Task',
    })
  })

  beforeEach(() => {
    useStore.setState((state) => ({
      time_entries: {
        ...state.time_entries,
        isLoading: false,
        error: null,
      },
    }))
  })

  afterAll(async () => {
    // delete the task created for time entries
    const { remove } = useStore.getState().tasks
    await remove('task-1')
  })

  test('initialize with default state', async () => {
    const state = useStore.getState()
    expect('data' in state.time_entries).toBe(false)
  })

  test('create a new time entry', async () => {
    const { add } = useStore.getState().time_entries
    const newTimeEntryData = {
      task_id: 'task-1',
      description: 'New Time Entry',
      start_time: getNowMillis(),
    }
    await add(newTimeEntryData)
    const newTimeEntry = (await readList('time_entries')).find(
      (te) => te.description === 'New Time Entry',
    )
    expect(newTimeEntry).toBeDefined()
    expect(await readList('time_entries')).toHaveLength(1)
  })

  test('throw error when creating time entry with missing fields', async () => {
    const { add } = useStore.getState().time_entries
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch time entries', async () => {
    /** Fetches the list of time entries. */
    const fetch = () => readList('time_entries')
    await fetch()

    const state = useStore.getState()
    expect(await readList('time_entries')).toHaveLength(1)
    expect((await readList('time_entries'))[0].description).toBe(
      'New Time Entry',
    )
    expect(state.time_entries.isLoading).toBe(false)
  })

  test('update an existing time entry', async () => {
    const { add, update } = useStore.getState().time_entries
    const newTimeEntryData = {
      task_id: 'task-1',
      description: 'Time Entry to Update',
      start_time: getNowMillis(),
    }
    await add(newTimeEntryData)

    const timeEntryToUpdate = (await readList('time_entries')).find(
      (te) => te.description === 'Time Entry to Update',
    )

    await update(timeEntryToUpdate!.id, {
      description: 'Updated Time Entry Description',
    })

    const updatedTimeEntry = (await readList('time_entries')).find(
      (te) => te.id === timeEntryToUpdate!.id,
    )
    expect(updatedTimeEntry!.description).toBe('Updated Time Entry Description')
  })

  test('delete an existing time entry', async () => {
    const { add, remove: deleteTimeEntry } = useStore.getState().time_entries
    const newTimeEntryData = {
      task_id: 'task-1',
      description: 'Time Entry to Delete',
      start_time: getNowMillis(),
    }
    await add(newTimeEntryData)

    const timeEntryToDelete = (await readList('time_entries')).find(
      (te) => te.description === 'Time Entry to Delete',
    )
    expect(timeEntryToDelete).toBeDefined()

    await deleteTimeEntry(timeEntryToDelete!.id)

    const deletedTimeEntry = (await readList('time_entries')).find(
      (te) => te.id === timeEntryToDelete!.id,
    )
    expect(deletedTimeEntry).toBeUndefined()
  })

  test('throw error when deleting non-existent time entry', async () => {
    const { remove: deleteTimeEntry } = useStore.getState().time_entries
    await expect(deleteTimeEntry('non-existent-id')).rejects.toThrow()
  })
})
