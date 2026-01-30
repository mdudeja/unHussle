import { afterAll } from 'bun:test'
import { useStore } from '@/store'

async function cleanupTestDatabase() {
  const state = useStore.getState()

  await state.projects.reset()
  await state.tasks.reset()
  await state.entity_tags.reset()
  await state.areas.reset()
  await state.goals.reset()
}

afterAll(async () => {
  await cleanupTestDatabase()
})
