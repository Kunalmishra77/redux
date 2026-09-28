'use client'

import { useSyncExternalStore } from 'react'

// One shared 30-second clock for live timers (SLA, WhatsApp window). null on the server and during
// hydration, so server and client markup always match.
const listeners = new Set<() => void>()
let current = 0
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!timer) {
    current = Date.now()
    timer = setInterval(() => { current = Date.now(); listeners.forEach((l) => l()) }, 30_000)
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size) { clearInterval(timer); timer = undefined }
  }
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => current || (current = Date.now()), () => null)
}
