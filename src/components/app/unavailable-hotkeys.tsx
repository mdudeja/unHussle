import { useHotkey } from '@/hooks/use-keydown-mgr'
import { HotkeyId } from '@/lib/hotkeys'

/**
 * Registers hotkeys that only explain why they do nothing, for while the
 * component that handles them is not shown. Renders nothing.
 */
export function UnavailableHotkeys({
  ids,
  message,
}: {
  ids: HotkeyId[]
  message: string
}) {
  return ids.map((id) => (
    <UnavailableHotkey key={id} id={id} message={message} />
  ))
}

function UnavailableHotkey({ id, message }: { id: HotkeyId; message: string }) {
  useHotkey(id, () => message)
  return null
}
