import { fileURLToPath } from 'bun'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle_migrations',
  dialect: 'sqlite',
  schema: './src-db-server/database/schemas/*.ts',

  dbCredentials: {
    url: fileURLToPath(
      new URL(
        process.env.DB_FILE_URL || './db/ecn:unhussle.sqlite',
        import.meta.url,
      ),
    ),
  },

  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations__',
  },

  strict: true,
  verbose: true,
  breakpoints: true,
})
