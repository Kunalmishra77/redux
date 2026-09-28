'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Droplets, Loader2, Sparkles, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { recordHandoverAction } from '@/lib/actions/jobs'
import { cn } from 'cn'

const CHECKS = [
  { key: 'leak_check', label: 'No leaks', hint: 'Every joint dry under full pressure for two minutes', icon: Droplets },
  { key: 'operation_check', label: 'Operates smoothly', hint: 'Handles, diverters and cartridges move freely, hot and cold', icon: Wrench },
  { key: 'finish_check', label: 'Finish as promised', hint: 'No spots, scratches or colour mismatch under daylight', icon: Sparkles },
] as const
type CheckKey = (typeof CHECKS)[number]['key']

export function HandoverForm({ jobId, noun, rooms, initial }: { jobId: string; noun: string; rooms: { id: string; label: string }[]; initial: string }) {
  const router = useRouter()
  const [unit, setUnit] = useState(initial)
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({ leak_check: false, operation_check: false, finish_check: false })
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, start] = useTransition()
  const all = CHECKS.every((c) => checks[c.key])
  const label = rooms.find((r) => r.id === unit)?.label

  const submit = () => start(async () => {
    const r = await recordHandoverAction(jobId, { job_unit_id: unit, ...checks, customer_name: name, notes })
    if (!r.ok) { toast.error(r.message); return }
    toast.success(`${noun} ${label} is back in service — warranty cards generated`)
    router.push(`/staff/jobs/${jobId}`)
  })

  return (
    <div className="grid max-w-3xl gap-6">
      <fieldset>
        <legend className="eyebrow mb-2 text-muted-ink">{noun}</legend>
        <div className="flex flex-wrap gap-2">
          {rooms.map((r) => (
            <button key={r.id} type="button" onClick={() => setUnit(r.id)} aria-pressed={unit === r.id}
              className={cn('rounded-md px-4 py-2 text-sm font-semibold ring-1', unit === r.id ? 'bg-redux-blue text-white ring-redux-blue' : 'bg-white text-ink ring-line hover:bg-surface')}>
              {noun} {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="eyebrow mb-2 text-muted-ink">Checks — all three must pass</legend>
        {CHECKS.map((c) => {
          const on = checks[c.key]
          return (
            <button key={c.key} type="button" role="checkbox" aria-checked={on} onClick={() => setChecks((s) => ({ ...s, [c.key]: !on }))}
              className={cn('flex w-full items-center gap-4 rounded-lg border bg-white p-4 text-left transition', on ? 'border-success bg-[#EAF7EE]' : 'border-line hover:border-redux-blue/40')}>
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', on ? 'bg-success text-white' : 'bg-pale text-redux-blue')}>
                {on ? <CheckCircle2 className="size-5" aria-hidden /> : <c.icon className="size-5" aria-hidden />}
              </span>
              <span><span className="block font-semibold text-ink">{c.label}</span><span className="text-sm text-muted-ink">{c.hint}</span></span>
            </button>
          )
        })}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="ho-name">Accepted by (customer’s representative)</Label>
          <Input id="ho-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anita Kapoor, Chief Engineer" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ho-notes">Notes (optional)</Label>
          <Textarea id="ho-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="lg" disabled={!all || !name.trim() || pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />} Sign off {noun.toLowerCase()} {label}
        </Button>
        {!all && <p className="text-sm text-muted-ink">A {noun.toLowerCase()} can’t return to service until every check passes.</p>}
      </div>
    </div>
  )
}
