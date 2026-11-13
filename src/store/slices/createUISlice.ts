import { apiAddress } from '@/lib/apiAddress'
import { makeTextRequest } from '@/lib/server'
import { EntityRouteKey } from '@/lib/entityRoutes'
import { StateCreator } from 'zustand'
import { Logger } from '@c/Logger'
import { ModifierKey, RefObject } from 'react'

// The entity shown in the global edit dialog (see EntityEditDialogHost).
export type EditingEntity = { kind: EntityRouteKey; id: string }

// A task action waiting on "did you stop at some point?" (see OvernightDialogHost).
export type OvernightPrompt = {
  taskId: string
  /** Set when the interval belongs to a recurring task's occurrence. */
  occurrenceId?: string | null
  startedAt: number
  then: 'pause' | 'complete' | 'cancel'
}

export type HotkeyModifier = Extract<
  ModifierKey,
  'Alt' | 'Control' | 'Meta' | 'Shift'
>

export type Hotkey = {
  /** Stable id, e.g. `sidebar.toggle`; user overrides will key off it. */
  id: string
  title: string
  description: string
  key: string
  modifier?: HotkeyModifier | HotkeyModifier[]
  /** `any` (default): one listed modifier held. `all`: every one held. */
  modifierMode?: 'any' | 'all'
  /** Returns why it could not run, if it could not; the user is shown it. */
  callback: (event: KeyboardEvent) => string | void
  /** Limits the hotkey to keys pressed inside this element. */
  target?: RefObject<HTMLElement | null>
}

/** The user-editable part of a hotkey. */
export type HotkeyBinding = Pick<Hotkey, 'key' | 'modifier' | 'modifierMode'>

export interface UISlice {
  isDBReady: boolean
  dbError?: string
  checkDBReady: () => Promise<void>
  editing: EditingEntity | null
  openEditor: (kind: EntityRouteKey, id: string) => void
  closeEditor: () => void
  overnightPrompt: OvernightPrompt | null
  askOvernight: (prompt: OvernightPrompt) => void
  closeOvernight: () => void
  hotkeys: {
    registry: Map<string, Hotkey[]>
    addHotkey: (hotkey: Hotkey) => void
    updateHotkey: (id: string, binding: HotkeyBinding) => void
    removeHotkey: (id: string) => void
    /** A new object per notice, so a repeated message restarts its timer. */
    notice: { message: string } | null
    showNotice: (message: string) => void
    clearNotice: () => void
  }
}

/** Creates the UI state slice that tracks database readiness and manages editor and overnight prompt state. */
export const createUISlice: StateCreator<UISlice> = (set) => ({
  isDBReady: false,
  checkDBReady: async () => {
    const maxRetries = 10
    const retryDelay = 2000 // 2 seconds

    const dbServerUrl = apiAddress('health')

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await makeTextRequest({
          url: dbServerUrl,
          method: 'GET',
        })
        if (response === 'OK') {
          Logger.getInstance().info('Database server is ready.')
          set(() => ({ isDBReady: true, dbError: undefined }))
          return
        }
      } catch (err) {
        Logger.getInstance().warn(
          `Attempt ${attempt} to connect to database server failed`,
          { error: err },
        )
        if (attempt === maxRetries) {
          set(() => ({
            isDBReady: false,
            dbError:
              'Failed to connect to database server after maximum retries',
          }))
          return
        }
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  },
  editing: null,
  openEditor: (kind, id) => set({ editing: { kind, id } }),
  closeEditor: () => set({ editing: null }),
  overnightPrompt: null,
  askOvernight: (prompt) => set({ overnightPrompt: prompt }),
  closeOvernight: () => set({ overnightPrompt: null }),
  hotkeys: {
    registry: new Map<string, Hotkey[]>(),
    // Re-adding an id replaces the old entry.
    addHotkey: (hotkey) =>
      set((state) => ({
        hotkeys: {
          ...state.hotkeys,
          registry: withHotkey(state.hotkeys.registry, hotkey),
        },
      })),
    updateHotkey: (id, binding) =>
      set((state) => {
        const existing = [...state.hotkeys.registry.values()]
          .flat()
          .find((hotkey) => hotkey.id === id)
        if (!existing) {
          throw new Error(`Cannot update unknown hotkey "${id}"`)
        }
        // Set each field explicitly so an omitted modifier clears the old one.
        const updated = {
          ...existing,
          key: binding.key,
          modifier: binding.modifier,
          modifierMode: binding.modifierMode,
        }
        return {
          hotkeys: {
            ...state.hotkeys,
            registry: withHotkey(state.hotkeys.registry, updated),
          },
        }
      }),
    removeHotkey: (id) =>
      set((state) => ({
        hotkeys: {
          ...state.hotkeys,
          registry: withoutHotkey(state.hotkeys.registry, id),
        },
      })),
    notice: null,
    showNotice: (message) =>
      set((state) => ({
        hotkeys: { ...state.hotkeys, notice: { message } },
      })),
    clearNotice: () =>
      set((state) => ({ hotkeys: { ...state.hotkeys, notice: null } })),
  },
})

/** Returns a copy of the registry with the hotkey added or replaced by id. */
function withHotkey(registry: Map<string, Hotkey[]>, hotkey: Hotkey) {
  const next = withoutHotkey(registry, hotkey.id)
  const key = hotkey.key.toLowerCase()
  next.set(key, [...(next.get(key) ?? []), hotkey])
  return next
}

/** Returns a copy of the registry without the hotkey with the given id. */
function withoutHotkey(registry: Map<string, Hotkey[]>, id: string) {
  const next = new Map<string, Hotkey[]>()
  for (const [key, hotkeys] of registry) {
    const kept = hotkeys.filter((hotkey) => hotkey.id !== id)
    if (kept.length > 0) {
      next.set(key, kept)
    }
  }
  return next
}
