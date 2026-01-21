import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle_migrations',
  dialect: 'sqlite',
  schema: './src/services/database/schemas/*.ts',

  dbCredentials: {
    url: process.env.DB_FILE_NAME as string,
  },

  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations__',
  },

  strict: true,
  verbose: true,
  breakpoints: true,
})
