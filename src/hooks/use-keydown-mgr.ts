import { useStore } from '@/store'
import { Hotkey, HotkeyModifier } from '@/store/slices/createUISlice'
import { HOTKEYS, HotkeyId } from '@/lib/hotkeys'
import { useEffect, useRef } from 'react'

const MODIFIER_KEYS: HotkeyModifier[] = ['Alt', 'Control', 'Meta', 'Shift']

/** Manages the hotkeys handled by `useHotkeyListener`. */
export function useKeydownMgr() {
  // Selected one by one so callers do not re-render on registry changes.
  const add = useStore((state) => state.hotkeys.addHotkey)
  const update = useStore((state) => state.hotkeys.updateHotkey)
  const remove = useStore((state) => state.hotkeys.removeHotkey)
  return { add, update, remove }
}

/**
 * Registers a hotkey from `HOTKEYS` while the component is mounted. It
 * registers once per id; later renders only refresh the callback, so it
 * always sees current state.
 */
export function useHotkey(
  id: HotkeyId,
  callback: Hotkey['callback'],
  target?: Hotkey['target'],
) {
  const { add, remove } = useKeydownMgr()
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    add({
      ...HOTKEYS[id],
      target,
      callback: (event) => callbackRef.current(event),
    })
    return () => remove(id)
  }, [add, remove, id, target])
}

/** Dispatches keydown events to registered hotkeys. Mount once, at the app root. */
export function useHotkeyListener() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A component (e.g. an open autocomplete) already handled this key.
      if (event.defaultPrevented) {
        return
      }
      const { registry, showNotice } = useStore.getState().hotkeys
      const matched = registry
        .get(event.key.toLowerCase())
        ?.find((hotkey) => matches(hotkey, event))
      if (!matched) {
        return
      }
      event.preventDefault()
      const unavailable = matched.callback(event)
      if (unavailable) {
        showNotice(unavailable)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

// Unscoped hotkeys pressed without Ctrl, Meta or Alt stay out of these,
// where plain keys type text or navigate the overlay.
const TYPING_OR_OVERLAY_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
].join(', ')

// Modifiers not listed on the hotkey must not be held, so Ctrl+Shift+B
// does not trigger a Ctrl+B hotkey.
function matches(hotkey: Hotkey, event: KeyboardEvent) {
  const listed = [hotkey.modifier ?? []].flat()
  const held = MODIFIER_KEYS.filter((key) => event.getModifierState(key))
  if (hotkey.target) {
    const target = hotkey.target.current
    if (!target || !target.contains(event.target as Node)) {
      return false
    }
  } else if (
    held.every((key) => key === 'Shift') &&
    event.target instanceof Element &&
    event.target.closest(TYPING_OR_OVERLAY_SELECTOR)
  ) {
    return false
  }
  if (held.some((key) => !listed.includes(key))) {
    return false
  }
  if (listed.length === 0) {
    return true
  }
  return hotkey.modifierMode === 'all'
    ? listed.every((key) => held.includes(key))
    : held.length > 0
}
