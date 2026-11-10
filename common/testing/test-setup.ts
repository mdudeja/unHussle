import { disposeFrontendRuntimes } from '@/bootstrap'
import { afterAll } from 'bun:test'
import { useStore } from '@/store'

/** Resets all application data stores to restore the test database to a clean baseline for testing. */
async function cleanupTestDatabase() {
  const state = useStore.getState()

  await state.tasks.reset()
  await state.resources.reset()

  await state.projects.reset()
  await state.areas.reset()
  await state.goals.reset()

  await state.tags.reset()
  await state.urls.reset()
  await state.time_entries.reset()
}

afterAll(async () => {
  await cleanupTestDatabase()
  disposeFrontendRuntimes()
})
