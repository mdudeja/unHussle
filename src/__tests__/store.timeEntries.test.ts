import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'
import { getNowMillis } from '@c/datetimeUtils'

describe('Time Entries Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      time_entries: {
        ...state.time_entries,
        data: [],
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', () => {
    const state = useStore.getState()
    expect(state.time_entries.data).toEqual([])
  })

  test('create a new time entry', async () => {
    const { add } = useStore.getState().time_entries
    const newTimeEntryData = {
      description: 'New Time Entry',
      start_time: getNowMillis(),
    }
    await add(newTimeEntryData)
    const state = useStore.getState()
    const newTimeEntry = state.time_entries.data.find(
      (te) => te.description === 'New Time Entry',
    )
    expect(newTimeEntry).toBeDefined()
    expect(state.time_entries.data).toHaveLength(1)
  })

  test('throw error when creating time entry with missing fields', async () => {
    const { add } = useStore.getState().time_entries
    expect(await add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch time entries', async () => {
    const { fetch } = useStore.getState().time_entries
    await fetch()

    const state = useStore.getState()
    expect(state.time_entries.data).toHaveLength(1)
    expect(state.time_entries.data[0].description).toBe('New Time Entry')
    expect(state.time_entries.isLoading).toBe(false)
  })

  test('update an existing time entry', async () => {
    const { add, update } = useStore.getState().time_entries
    const newTimeEntryData = {
      description: 'Time Entry to Update',
      start_time: getNowMillis(),
    }
    await add(newTimeEntryData)

    let state = useStore.getState()
    const timeEntryToUpdate = state.time_entries.data.find(
      (te) => te.description === 'Time Entry to Update',
    )

    await update(timeEntryToUpdate!.id, {
      description: 'Updated Time Entry Description',
    })

    state = useStore.getState()
    const updatedTimeEntry = state.time_entries.data.find(
      (te) => te.id === timeEntryToUpdate!.id,
    )
    expect(updatedTimeEntry!.description).toBe('Updated Time Entry Description')
  })

  test('delete an existing time entry', async () => {
    const { add, remove: deleteTimeEntry } = useStore.getState().time_entries
    const newTimeEntryData = {
      description: 'Time Entry to Delete',
      start_time: getNowMillis(),
    }
    await add(newTimeEntryData)

    let state = useStore.getState()
    const timeEntryToDelete = state.time_entries.data.find(
      (te) => te.description === 'Time Entry to Delete',
    )
    expect(timeEntryToDelete).toBeDefined()

    await deleteTimeEntry(timeEntryToDelete!.id)

    state = useStore.getState()
    const deletedTimeEntry = state.time_entries.data.find(
      (te) => te.id === timeEntryToDelete!.id,
    )
    expect(deletedTimeEntry).toBeUndefined()
    expect(state.time_entries.data).toHaveLength(0)
  })

  test('throw error when deleting non-existent time entry', async () => {
    const { remove: deleteTimeEntry } = useStore.getState().time_entries
    expect(await deleteTimeEntry('non-existent-id')).rejects.toThrow()
  })
})
