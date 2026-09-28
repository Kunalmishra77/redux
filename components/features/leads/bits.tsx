'use client'

import { useNow } from '@/lib/hooks/use-now'
import { cn } from 'cn'
import { SOURCES } from '@/lib/constants/sources'


// B6: "Source shown as a coloured dot + label — the executive reads channel at a glance"
export function SourceBadge({ code, className }: { code: string; className?: string }) {
  const s = SOURCES[code] ?? { label: code, dot: 'bg-faint' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-muted-ink', className)}>
      <span className={cn('size-2 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  )
}

function fmt(ms: number) {
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  if (h >= 48) return `${Math.floor(h / 24)}d`
  return h ? `${h}h ${m}m` : `${m}m`
}

/** BR-L5: the call-back clock runs from creation. Ticks live; red once breached. */
export function SlaTimer({ due, done }: { due: string | null; done?: boolean }) {
  const now = useNow()
  if (!due || done) return null
  if (now === null) return <span className="num text-xs text-faint">—</span>
  const left = new Date(due).getTime() - now
  const breached = left < 0
  return (
    <span className={cn('num inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-semibold',
      breached ? 'bg-danger-bg text-danger' : left < 15 * 60_000 ? 'bg-warning-bg text-warning' : 'bg-surface text-muted-ink')}
      title={breached ? 'Call-back SLA breached' : 'Time left to call back'}>
      {breached ? `${fmt(left)} late` : `${fmt(left)} left`}
    </span>
  )
}
