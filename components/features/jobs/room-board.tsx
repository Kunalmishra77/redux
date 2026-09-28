import { AlertTriangle } from 'lucide-react'
import { JOB_STAGES } from '@/components/patterns'
import { BLOCK_REASONS, UNIT_STATUS } from '@/lib/constants/statuses'
import { cn } from 'cn'

export type BoardUnit = { id: string; label: string; status: string; current_stage: string; block?: { reason: string; note: string | null } | null }

// B24 — the room status board. Same board in the customer portal. A blocked room names who it is
// waiting on; that attribution is the point of the screen (BR-J2).
export function RoomBoard({ units, noun = 'Room', large = false }: { units: BoardUnit[]; noun?: string; large?: boolean }) {
  return (
    <ul className={cn('grid gap-3', large ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4')}>
      {units.map((u) => {
        const st = UNIT_STATUS[u.status] ?? UNIT_STATUS.scheduled!
        const stage = JOB_STAGES.find((s) => s.key === u.current_stage)
        const idx = JOB_STAGES.findIndex((s) => s.key === u.current_stage)
        const blockedOn = u.block ? BLOCK_REASONS[u.block.reason] : null
        return (
          <li key={u.id} className={cn('rounded-lg border p-3', st.tile, large && 'p-4')}>
            <p className={cn('font-semibold text-ink', large ? 'text-lg' : 'text-sm')}>{noun} {u.label}</p>
            {u.status === 'blocked' ? (
              <p className="mt-1 flex items-start gap-1 text-xs font-medium text-danger">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>Blocked — {blockedOn?.label.toLowerCase() ?? 'on hold'} ({blockedOn?.on === 'see note' ? u.block?.note : blockedOn?.on}){u.block?.note && blockedOn?.on !== 'see note' ? ` · ${u.block.note}` : ''}</span>
              </p>
            ) : (
              <p className={cn('mt-1 text-xs', u.status === 'back_in_service' ? 'font-medium text-success' : 'text-muted-ink')}>
                {u.status === 'back_in_service' ? 'Back in service' : stage?.label}
              </p>
            )}
            <div className="mt-2 flex gap-0.5" aria-hidden>
              {JOB_STAGES.map((s, i) => <span key={s.key} className={cn('h-1 flex-1 rounded-full', i <= idx ? (u.status === 'blocked' ? 'bg-danger/50' : 'bg-redux-blue') : 'bg-line')} />)}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
