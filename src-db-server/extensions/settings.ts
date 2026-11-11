import { eq } from 'drizzle-orm'
import {
  appSettings,
  type AppSettings,
} from '@d/database/schemas/app.settings.schema'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import type { JsonValue } from '@c/extensions/sdk'

const SETTINGS_ID = 'default'

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key)

export async function readAppSettings(database: UnHussleDB) {
  const db = await database.getDb()
  return (
    db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID)).get()
      ?.settings ?? {}
  )
}

/** Read-modify-write in one transaction, so other settings are preserved. */
export async function updateAppSettings(
  database: UnHussleDB,
  update: (settings: AppSettings) => AppSettings,
) {
  const db = await database.getDb()
  db.transaction((tx) => {
    const next = update(
      tx.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID)).get()
        ?.settings ?? {},
    )
    tx.insert(appSettings)
      .values({ id: SETTINGS_ID, settings: next })
      .onConflictDoUpdate({ target: appSettings.id, set: { settings: next } })
      .run()
  })
}

/** Per-extension JSON settings in `app_settings.settings.extensions[id]`. */
export function extensionSettings(database: UnHussleDB) {
  return {
    get: async (owner: string, key: string) => {
      const all = (await readAppSettings(database)).extensions
      if (!all || !hasOwn(all, owner)) return undefined
      return hasOwn(all[owner], key) ? all[owner][key] : undefined
    },
    set: (owner: string, key: string, value: JsonValue) =>
      updateAppSettings(database, (settings) => ({
        ...settings,
        extensions: {
          ...settings.extensions,
          [owner]: { ...settings.extensions?.[owner], [key]: value },
        },
      })),
  }
}
