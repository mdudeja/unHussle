import { setAdapterFactory } from '@/services/database/db'
import { BunSqliteAdapter } from '@/services/database/adapters/BunSqliteAdapter'
import { runDataLayerTests } from './dataLayerTest'

const run = async () => {
  try {
    console.log('🚀 Starting Data Layer Tests (Bun Native)...')

    // 1. Configure the DB to use BunSqliteAdapter (in-memory)
    setAdapterFactory(() => new BunSqliteAdapter(':memory:'))

    // 2. Run the tests
    const results = await runDataLayerTests()

    // 3. Exit with correct code
    const success = results.every((r) => r.success)
    if (success) {
      console.log('\n✨ All tests passed!')
      process.exit(0)
    } else {
      console.error('\n💥 Some tests failed.')
      process.exit(1)
    }
  } catch (e) {
    console.error('Fatal Runner Error:', e)
    process.exit(1)
  }
}

run()
