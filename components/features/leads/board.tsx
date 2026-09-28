'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { markLostAction, moveLeadAction } from '@/lib/actions/leads'
import { SourceBadge } from './bits'

export type BoardCard = { id: string; title: string; line: string; source: string; status: string }
const COLUMNS = [
  { key: 'new', label: 'New' }, { key: 'contacted', label: 'Contacted' }, { key: 'survey_booked', label: 'Survey booked' },
  { key: 'surveyed', label: 'Surveyed' }, { key: 'quoted', label: 'Quoted' }, { key: 'won', label: 'Won' },
]

// B8 — cards deliberately minimal (name, one line, source). Drag to move; Lost asks for the reason.
// Keyboard users move a card with its menu, since drag is mouse-only (§9 accessibility).
export function PipelineBoard({ cards, lostCount, reasons }: { cards: BoardCard[]; lostCount: number; reasons: { code: string; name: string; requiresNote: boolean }[] }) {
  const router = useRouter()
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [lostFor, setLostFor] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()

  function move(id: string, to: string) {
    if (to === 'lost') { setLostFor(id); return }
    const card = cards.find((c) => c.id === id)
    if (!card || card.status === to) return
    start(async () => {
      const r = await moveLeadAction(id, to)
      if (r.ok) { toast.success('Lead moved'); router.refresh() } else toast.info(r.message)
    })
  }

  return (
    <>
      <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-6">
        {COLUMNS.map((col) => {
          const list = cards.filter((c) => c.status === col.key)
          return (
            <section key={col.key} aria-label={`${col.label} — ${list.length}`}
              onDragOver={(e) => { e.preventDefault(); setOver(col.key) }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (dragging) move(dragging, col.key) }}
              className={cn('flex min-h-[28rem] min-w-56 flex-col rounded-lg border p-2.5 transition-colors',
                col.key === 'won' ? 'border-redux-lime/60 bg-[#f1fee5]' : 'border-line bg-white/60',
                over === col.key && 'ring-2 ring-redux-blue')}>
              <header className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-ink">{col.label}</h2>
                <span className="num rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted-ink ring-1 ring-line">{list.length}</span>
              </header>
              <ul className="space-y-2">
                {list.map((c) => (
                  <li key={c.id} draggable onDragStart={() => setDragging(c.id)} onDragEnd={() => setDragging(null)}
                    className={cn('cursor-grab rounded-md border border-line bg-white p-3 shadow-card active:cursor-grabbing', dragging === c.id && 'opacity-50', pending && 'pointer-events-none')}>
                    <Link href={`/staff/leads/${c.id}`} className="block truncate text-sm font-semibold text-ink hover:text-redux-blue">{c.title}</Link>
                    <p className="truncate text-xs text-muted-ink">{c.line}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <SourceBadge code={c.source} />
                      <label className="sr-only" htmlFor={`mv-${c.id}`}>Move {c.title}</label>
                      <select id={`mv-${c.id}`} value="" onChange={(e) => e.target.value && move(c.id, e.target.value)}
                        className="rounded-sm border border-transparent bg-transparent text-xs text-faint hover:border-line focus:border-redux-blue">
                        <option value="">Move…</option>
                        {COLUMNS.filter((x) => x.key !== c.status).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                        <option value="lost">Lost</option>
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm shadow-card">
        <p className="text-muted-ink">After Won the work continues as the job: <strong className="text-ink">Won → In restoration → Completed → Warranty active</strong></p>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragging) move(dragging, 'lost') }}
          className="rounded-md border-2 border-dashed border-danger/40 px-4 py-2 text-danger">
          Drop here to mark lost · <Link href="/staff/leads?status=lost" className="font-semibold underline-offset-2 hover:underline"><span className="num">{lostCount}</span> lost</Link>
        </div>
      </div>

      <Dialog open={!!lostFor} onOpenChange={(o) => !o && setLostFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Why was it lost?</DialogTitle><DialogDescription>A reason is required (BR-L7).</DialogDescription></DialogHeader>
          <div className="grid gap-2">
            {reasons.map((r) => (
              <button key={r.code} type="button" onClick={() => setReason(r.code)} aria-pressed={reason === r.code}
                className={cn('rounded-md border px-3 py-2 text-left text-sm', reason === r.code ? 'border-redux-blue bg-select font-semibold text-redux-blue' : 'border-line hover:bg-surface')}>{r.name}</button>
            ))}
          </div>
          {reasons.find((r) => r.code === reason)?.requiresNote && <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" placeholder="Tell us more" />}
          <DialogFooter>
            <Button variant="destructive" disabled={!reason || pending} onClick={() => start(async () => {
              const r = await markLostAction({ leadId: lostFor!, reasonCode: reason, note })
              if (r.ok) { toast.success('Marked lost'); setLostFor(null); setReason(''); setNote(''); router.refresh() } else toast.error(r.message)
            })}>Mark lost</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
