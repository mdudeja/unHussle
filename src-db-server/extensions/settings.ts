import { eq } from 'drizzle-orm'
import { appSettings } from '@d/database/schemas/app.settings.schema'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import type { JsonValue } from '@c/extensions/sdk'

/** Scoped JSON settings share the existing settings column; no schema migration is needed. */
export function extensionSettings(database: UnHussleDB) {
  return {
    /** Retrieves the extension setting value configured for the given owner and key from the default application settings. */
    get: async (owner: string, key: string) => {
      const db = await database.getDb()
      const all = db
        .select()
        .from(appSettings)
        .where(eq(appSettings.id, 'default'))
        .get()?.settings.extensions
      if (!all || !Object.prototype.hasOwnProperty.call(all, owner))
        return undefined
      const settings = all[owner]
      return Object.prototype.hasOwnProperty.call(settings, key)
        ? settings[key]
        : undefined
    },
    /** Stores or updates a setting value for a specific extension owner. */
    set: async (owner: string, key: string, value: JsonValue) => {
      const db = await database.getDb()
      db.transaction((tx) => {
        const settings =
          tx
            .select()
            .from(appSettings)
            .where(eq(appSettings.id, 'default'))
            .get()?.settings ?? {}
        const next = {
          ...settings,
          extensions: {
            ...settings.extensions,
            [owner]: { ...settings.extensions?.[owner], [key]: value },
          },
        }
        tx.insert(appSettings)
          .values({ id: 'default', settings: next })
          .onConflictDoUpdate({
            target: appSettings.id,
            set: { settings: next },
          })
          .run()
      })
    },
  }
}
