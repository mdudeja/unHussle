import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { JsonValue } from '@c/extensions/sdk'

export type AppSettings = {
  /** Absolute vault folder chosen by the user; falls back to `VAULT_DIR`. */
  vaultDir?: string
  /** Absolute extensions folder chosen by the user; falls back to `EXTENSIONS_DIR`. */
  extensionsDir?: string
  /** IDs of extensions the user turned on. */
  enabledExtensions?: string[]
  /** Per-extension settings, keyed by extension ID. */
  extensions?: Record<string, Record<string, JsonValue>>
}

// One `default` row, like `scheduler_settings`.
export const appSettings = sqliteTable('app_settings', {
  id: text().primaryKey(),
  settings: text({ mode: 'json' }).$type<AppSettings>().notNull(),
})
