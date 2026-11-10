import * as React from 'react'

const MOBILE_BREAKPOINT = 768

/** Subscribes to changes in whether the viewport is below the mobile breakpoint. */
const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** Determines whether the current viewport is considered mobile. */
const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT

/** Determines whether the current device or viewport should be treated as mobile for responsive rendering. */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot)
}
