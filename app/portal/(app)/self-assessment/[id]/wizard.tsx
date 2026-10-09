'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, Check, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SLOT_LABEL, SLOTS } from '@/lib/constants/assessment'
import { removeFittingAction, saveFittingAction, submitSelfAssessmentAction } from '@/lib/actions/self-assessment'

// CR-001 phase 4 (D27) — the customer's self-assessment (ADR-015, BR-S10): fittings, each with the
// same four photo slots the surveyor takes. Photos are shrunk on the phone before upload.

export type WizardFitting = {
  id: string; unit_label: string; fitting_type_id: string; current_finish_id: string; notes: string
  condition_ids: string[]; photos: Record<string, string>
}
type Opt = { id: string; name: string }

const HINT: Record<string, string> = {
  front: 'Straight on, the whole fitting', side: 'From the left or right', top: 'From above — handles and cartridge', close_up: 'The worst spot: wear, leak or scale',
}

/** Resize to at most 1600 px on the long side and re-encode as JPEG. */
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85))
  return { blob, width, height }
}

export function SelfAssessmentWizard({ surveyId, open, noun, fittings, types, finishes, flags }: {
  surveyId: string; open: boolean; noun: string; fittings: WizardFitting[]; types: Opt[]; finishes: Opt[]; flags: Opt[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<WizardFitting | 'new' | null>(fittings.length === 0 && open ? 'new' : null)
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? 'Fitting'
  const complete = fittings.filter((f) => SLOTS.every((s) => f.photos[s]))
  const ready = fittings.length > 0 && complete.length === fittings.length

  const upload = async (fittingId: string, slot: string, file: File | undefined) => {
    if (!file) return
    setBusySlot(`${fittingId}:${slot}`)
    try {
      const { blob, width, height } = await shrink(file)
      const fd = new FormData()
      fd.set('fittingId', fittingId); fd.set('slot', slot); fd.set('width', String(width)); fd.set('height', String(height))
      fd.set('file', blob, `${slot}.jpg`)
      const r = await fetch('/api/self-assessment/photo', { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({ ok: false, message: 'The upload did not finish — try again.' }))
      if (!j.ok) toast.error(j.message); else router.refresh()
    } catch {
      toast.error('That photo could not be read. Try taking it again.')
    } finally {
      setBusySlot(null)
    }
  }

  const remove = (f: WizardFitting) => start(async () => {
    const r = await removeFittingAction(surveyId, f.id)
    if (r.ok) { toast.success('Removed'); router.refresh() } else toast.error(r.message)
  })
  const submit = () => start(async () => {
    const r = await submitSelfAssessmentAction(surveyId)
    if (r.ok) { toast.success('Sent to REDUX'); setConfirm(false); router.refresh() } else toast.error(r.message)
  })

  return (
    <div className="space-y-4">
      {fittings.map((f, i) => {
        const done = SLOTS.every((s) => f.photos[s])
        return (
          <section key={f.id} className="rounded-xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-ink">Fitting {i + 1} · {/^\d/.test(f.unit_label) ? `${noun} ${f.unit_label}` : f.unit_label}</p>
                <p className="font-semibold text-ink">{typeName(f.fitting_type_id)}{f.current_finish_id ? <span className="font-normal text-muted-ink"> · {finishes.find((x) => x.id === f.current_finish_id)?.name}</span> : null}</p>
                {f.condition_ids.length > 0 && <p className="mt-0.5 text-xs text-muted-ink">{f.condition_ids.map((c) => flags.find((x) => x.id === c)?.name).filter(Boolean).join(', ')}</p>}
              </div>
              {done ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"><Check className="size-3.5" aria-hidden /> Done</span>
                : <span className="num shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-muted-ink">{SLOTS.filter((s) => f.photos[s]).length}/4 photos</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SLOTS.map((slot) => {
                const url = f.photos[slot]
                const busy = busySlot === `${f.id}:${slot}`
                const inputId = `ph-${f.id}-${slot}`
                return (
                  <div key={slot} className="relative overflow-hidden rounded-lg border border-line bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {url ? <img src={url} alt={`${typeName(f.fitting_type_id)} — ${SLOT_LABEL[slot]}`} className="aspect-[4/3] w-full object-cover" />
                      : <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 p-2 text-center"><Camera className="size-5 text-redux-blue" aria-hidden /><span className="text-[11px] leading-tight text-muted-ink">{HINT[slot]}</span></div>}
                    <span className="eyebrow absolute top-1 left-1 rounded-sm bg-ink/75 px-1.5 py-0.5 text-[9px] text-white">{SLOT_LABEL[slot]}</span>
                    {open && (
                      <label htmlFor={inputId} className={`absolute inset-x-1 bottom-1 flex cursor-pointer items-center justify-center gap-1 rounded-md py-1 text-xs font-semibold ${url ? 'bg-white/90 text-ink' : 'bg-redux-blue text-white'}`}>
                        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Camera className="size-3.5" aria-hidden />}{busy ? 'Uploading…' : url ? 'Retake' : 'Take photo'}
                        <input id={inputId} type="file" accept="image/*" capture="environment" className="sr-only" disabled={!!busySlot}
                          onChange={(e) => { void upload(f.id, slot, e.target.files?.[0]); e.target.value = '' }} />
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
            {open && (
              <div className="mt-3 flex gap-2">
                <Button size="xs" variant="outline" onClick={() => setEditing(f)}><Pencil aria-hidden /> Edit details</Button>
                {SLOTS.every((s) => !f.photos[s]) && <Button size="xs" variant="ghost" disabled={pending} onClick={() => remove(f)}><Trash2 aria-hidden /> Remove</Button>}
              </div>
            )}
          </section>
        )
      })}

      {open && (
        <>
          <Button variant="outline" className="w-full" onClick={() => setEditing('new')}><Plus aria-hidden /> Add a fitting</Button>
          <div className="sticky bottom-3 z-10 rounded-xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink"><span className="num font-semibold">{complete.length}</span> of <span className="num">{fittings.length}</span> fittings ready</p>
              <Button disabled={!ready || pending} onClick={() => setConfirm(true)}><Send aria-hidden /> Send to REDUX</Button>
            </div>
            {!ready && fittings.length > 0 && <p className="mt-1 text-xs text-muted-ink">Each fitting needs all four photos.</p>}
          </div>
        </>
      )}

      {editing && (
        <FittingDialog surveyId={surveyId} noun={noun} fitting={editing === 'new' ? null : editing} types={types} finishes={finishes} flags={flags}
          lastUnit={fittings.at(-1)?.unit_label ?? ''} onClose={() => setEditing(null)} />
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send your self-assessment?</DialogTitle>
            <DialogDescription>{fittings.length} fittings with four photos each. After sending you can’t change it — if we need anything more, we’ll ask on WhatsApp.</DialogDescription></DialogHeader>
          <DialogFooter><Button disabled={pending} onClick={submit}>{pending && <Loader2 className="animate-spin" />} Send</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FittingDialog({ surveyId, noun, fitting, types, finishes, flags, lastUnit, onClose }: {
  surveyId: string; noun: string; fitting: WizardFitting | null; types: Opt[]; finishes: Opt[]; flags: Opt[]; lastUnit: string; onClose: () => void
}) {
  const router = useRouter()
  const [f, setF] = useState({
    unit_label: fitting?.unit_label ?? lastUnit, fitting_type_id: fitting?.fitting_type_id ?? '', current_finish_id: fitting?.current_finish_id ?? '',
    notes: fitting?.notes ?? '', condition_ids: fitting?.condition_ids ?? [],
  })
  const [pending, start] = useTransition()
  const save = () => start(async () => {
    const r = await saveFittingAction(surveyId, f, fitting?.id)
    if (r.ok) { toast.success(fitting ? 'Saved' : 'Added — now take its four photos'); onClose(); router.refresh() } else toast.error(r.message)
  })
  const toggle = (id: string) => setF({ ...f, condition_ids: f.condition_ids.includes(id) ? f.condition_ids.filter((x) => x !== id) : [...f.condition_ids, id] })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{fitting ? 'Fitting details' : 'Add a fitting'}</DialogTitle><DialogDescription>One tap, mixer, shower or valve at a time.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="fx-unit">{noun} number or name</Label><Input id="fx-unit" value={f.unit_label} onChange={(e) => setF({ ...f, unit_label: e.target.value })} placeholder={noun === 'Room' ? 'e.g. 204' : 'e.g. Master bathroom'} /></div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-ink">What is it?</legend>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => <button key={t.id} type="button" aria-pressed={f.fitting_type_id === t.id} onClick={() => setF({ ...f, fitting_type_id: t.id })}
                className={`rounded-lg px-3 py-2.5 text-left text-sm ring-1 ${f.fitting_type_id === t.id ? 'bg-redux-blue text-white ring-redux-blue' : 'text-ink ring-line hover:bg-surface'}`}>{t.name}</button>)}
            </div>
          </fieldset>
          <div className="space-y-1.5"><Label htmlFor="fx-finish">Finish today</Label>
            <select id="fx-finish" className="h-10 w-full rounded-md border border-line bg-white px-2 text-sm" value={f.current_finish_id} onChange={(e) => setF({ ...f, current_finish_id: e.target.value })}>
              <option value="">Not sure</option>{finishes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select></div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-ink">What’s wrong? <span className="font-normal text-muted-ink">(tick any)</span></legend>
            <div className="flex flex-wrap gap-2">
              {flags.map((x) => <button key={x.id} type="button" aria-pressed={f.condition_ids.includes(x.id)} onClick={() => toggle(x.id)}
                className={`rounded-full px-3 py-1 text-sm ring-1 ${f.condition_ids.includes(x.id) ? 'bg-redux-blue text-white ring-redux-blue' : 'text-ink ring-line'}`}>{x.name}</button>)}
            </div>
          </fieldset>
          <div className="space-y-1.5"><Label htmlFor="fx-notes">Anything else? <span className="font-normal text-muted-ink">(optional)</span></Label><Textarea id="fx-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button disabled={pending || !f.fitting_type_id || !f.unit_label.trim()} onClick={save}>{pending && <Loader2 className="animate-spin" />} {fitting ? 'Save' : 'Add fitting'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
