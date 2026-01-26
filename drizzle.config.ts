import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle_migrations',
  dialect: 'sqlite',
  schema: './src-db-server/database/schemas/*.ts',

  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations__',
  },

  strict: true,
  verbose: true,
  breakpoints: true,
})
