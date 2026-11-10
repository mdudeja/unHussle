import { readList } from '@c/testing/frontendReads'
import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Goals Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      goals: {
        ...state.goals,
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', async () => {
    const state = useStore.getState()
    expect('data' in state.goals).toBe(false)
  })

  test('create a new goal', async () => {
    const { add } = useStore.getState().goals
    const newGoalData = {
      title: 'New Goal',
    }
    await add(newGoalData)
    const newGoal = (await readList('goals')).find(
      (g) => g.title === 'New Goal',
    )

    expect(newGoal).toBeDefined()
    expect(
      (await readList('goals')).filter((row) => row.title === 'New Goal'),
    ).toHaveLength(1)
  })

  test('throw error when creating goal with missing fields', async () => {
    const { add } = useStore.getState().goals
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch goals', async () => {
    /** Fetches the list of goals. */
    const fetch = () => readList('goals')
    await fetch()

    const state = useStore.getState()
    expect(await readList('goals')).toHaveLength(8) // seed data has 7 goals
    expect(
      (await readList('goals'))[(await readList('goals')).length - 1].title,
    ).toBe('New Goal')
    expect(state.goals.isLoading).toBe(false)
  })

  test('update an existing goal', async () => {
    const { add, update } = useStore.getState().goals
    const newGoalData = {
      title: 'Goal to Update',
    }
    await add(newGoalData)

    const goalToUpdate = (await readList('goals')).find(
      (g) => g.title === 'Goal to Update',
    )
    expect(goalToUpdate).toBeDefined()

    await update(goalToUpdate!.id, { title: 'Updated Goal Title' })

    const updatedGoal = (await readList('goals')).find(
      (g) => g.id === goalToUpdate!.id,
    )
    expect(updatedGoal!.title).toBe('Updated Goal Title')
  })

  test('throw error when updating non-existent goal', async () => {
    const { update } = useStore.getState().goals
    await expect(update('non-existent-id', { title: 'Fail' })).rejects.toThrow()
  })

  test('delete an existing goal', async () => {
    const { add, remove: deleteGoal } = useStore.getState().goals
    const newGoalData = {
      title: 'Goal to Delete',
    }
    await add(newGoalData)

    const goalToDelete = (await readList('goals')).find(
      (g) => g.title === 'Goal to Delete',
    )
    expect(goalToDelete).toBeDefined()

    await deleteGoal(goalToDelete!.id)

    const deletedGoal = (await readList('goals')).find(
      (g) => g.id === goalToDelete!.id,
    )
    expect(deletedGoal).toBeUndefined()
  })

  test('throw error when deleting non-existent goal', async () => {
    const { remove: deleteGoal } = useStore.getState().goals
    await expect(deleteGoal('non-existent-id')).rejects.toThrow()
  })
})
