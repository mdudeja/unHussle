import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Goals Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      goals: {
        ...state.goals,
        data: [],
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', () => {
    const state = useStore.getState()
    expect(state.goals.data).toEqual([])
  })

  test('create a new goal', async () => {
    const { add } = useStore.getState().goals
    const newGoalData = {
      title: 'New Goal',
    }
    await add(newGoalData)
    const state = useStore.getState()
    const newGoal = state.goals.data.find((g) => g.title === 'New Goal')

    expect(newGoal).toBeDefined()
    expect(state.goals.data).toHaveLength(1)
  })

  test('throw error when creating goal with missing fields', async () => {
    const { add } = useStore.getState().goals
    expect(add({} as any)).rejects.toThrow()
  })

  test('fetch goals', async () => {
    const { fetch } = useStore.getState().goals
    await fetch()

    const state = useStore.getState()
    expect(state.goals.data).toHaveLength(1)
    expect(state.goals.data[0].title).toBe('New Goal')
    expect(state.goals.isLoading).toBe(false)
  })

  test('update an existing goal', async () => {
    const { add, update } = useStore.getState().goals
    const newGoalData = {
      title: 'Goal to Update',
    }
    await add(newGoalData)

    let state = useStore.getState()
    const goalToUpdate = state.goals.data.find(
      (g) => g.title === 'Goal to Update',
    )
    expect(goalToUpdate).toBeDefined()

    await update(goalToUpdate!.id, { title: 'Updated Goal Title' })

    state = useStore.getState()
    const updatedGoal = state.goals.data.find((g) => g.id === goalToUpdate!.id)
    expect(updatedGoal!.title).toBe('Updated Goal Title')
  })

  test('throw error when updating non-existent goal', async () => {
    const { update } = useStore.getState().goals
    expect(update('non-existent-id', { title: 'Fail' })).rejects.toThrow()
  })

  test('delete an existing goal', async () => {
    const { add, remove: deleteGoal } = useStore.getState().goals
    const newGoalData = {
      title: 'Goal to Delete',
    }
    await add(newGoalData)

    let state = useStore.getState()
    const goalToDelete = state.goals.data.find(
      (g) => g.title === 'Goal to Delete',
    )
    expect(goalToDelete).toBeDefined()

    await deleteGoal(goalToDelete!.id)

    state = useStore.getState()
    const deletedGoal = state.goals.data.find((g) => g.id === goalToDelete!.id)
    expect(deletedGoal).toBeUndefined()
  })

  test('throw error when deleting non-existent goal', async () => {
    const { remove: deleteGoal } = useStore.getState().goals
    expect(deleteGoal('non-existent-id')).rejects.toThrow()
  })
})
