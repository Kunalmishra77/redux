import { useEffect, useState } from 'react'

// A tiny change bus: any local write or sync step bumps the version and screens re-read SQLite.
type Listener = () => void
const listeners = new Set<Listener>()
let version = 0

export function emitChange() {
  version++
  for (const l of listeners) l()
}

export function subscribe(l: Listener) {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** Re-renders the caller whenever local data changes. */
export function useDataVersion(): number {
  const [v, setV] = useState(version)
  useEffect(() => subscribe(() => setV(version)), [])
  return v
}

/** Loads `fn` now and again after every local change. */
export function useLocalQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean } {
  const v = useDataVersion()
  const [state, setState] = useState<{ data: T | undefined; loading: boolean }>({ data: undefined, loading: true })
  useEffect(() => {
    let alive = true
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      () => alive && setState((s) => ({ ...s, loading: false })),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, ...deps])
  return state
}
