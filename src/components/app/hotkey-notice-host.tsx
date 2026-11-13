import { useEffect } from 'react'
import { useStore } from '@/store'

const NOTICE_MILLIS = 4000

/** Says why a pressed hotkey did nothing, then hides itself. */
export function HotkeyNoticeHost() {
  const notice = useStore((state) => state.hotkeys.notice)
  const clearNotice = useStore((state) => state.hotkeys.clearNotice)

  useEffect(() => {
    if (!notice) return
    const handle = setTimeout(clearNotice, NOTICE_MILLIS)
    return () => clearTimeout(handle)
  }, [notice, clearNotice])

  // Always rendered, so screen readers announce each new message.
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      {notice && (
        <p className="rounded-md border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-md">
          {notice.message}
        </p>
      )}
    </div>
  )
}
