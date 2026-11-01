import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export type AppSettings = {
  /** Absolute vault folder chosen by the user; falls back to `VAULT_DIR`. */
  vaultDir?: string
}

// One `default` row, like `scheduler_settings`.
export const appSettings = sqliteTable('app_settings', {
  id: text().primaryKey(),
  settings: text({ mode: 'json' }).$type<AppSettings>().notNull(),
})
