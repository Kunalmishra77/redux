'use client'

import { useEffect, useRef } from 'react'

/**
 * On narrow screens a list and its detail stack vertically, so picking an item changes something
 * below the fold. This scrolls the detail into view when `when` changes — only below `below` px.
 */
export function ScrollIntoViewOnChange({ when, below = 1024, enabled = true }: { when: string; below?: number; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; if (!enabled) return }
    if (window.innerWidth < below) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [when, below, enabled])
  return <div ref={ref} className="scroll-mt-20" aria-hidden />
}
