'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DEMO_LABEL, MODE_LABEL } from '@/lib/constants/assessment'
import {
  previewScoreAction, rescoreAllAction, savePolicyAction, saveScoringRuleAction, saveServiceAreaAction, saveThresholdsAction, type Preview,
} from '@/lib/actions/scoring'

const FACTORS = { units: 'Rooms', value: 'Estimated value (₹)', segment: 'Segment', source: 'Lead source', distance_band: 'Distance band', group_member: 'Hotel chain / group', repeat_customer: 'Existing customer', referral: 'Referred' } as const
const OPS = { gte: 'at least', between: 'between', in: 'is one of', is_true: 'is yes' } as const
const sel = 'h-9 rounded-md border border-line bg-white px-2 text-sm'

function useSave() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: string, after?: () => void) => start(async () => {
    const r = await fn()
    if (r.ok) { toast.success(done); after?.(); router.refresh() } else toast.error(r.message)
  })
  return { pending, run }
}

type Rule = { id: string; factor: string; operator: string; value: string; points: number; label: string; is_active: boolean }

export function RuleRow({ rule }: { rule: Rule | null }) {
  const blank: Rule = { id: '', factor: 'units', operator: 'gte', value: '', points: 10, label: '', is_active: true }
  const [r, setR] = useState<Rule>(rule ?? blank)
  const { pending, run } = useSave()
  const dirty = rule === null ? r.label.trim().length > 1 : JSON.stringify(r) !== JSON.stringify(rule)
  return (
    <tr className={`border-b border-line last:border-0 ${rule === null ? 'bg-surface/60' : ''} ${!r.is_active ? 'opacity-60' : ''}`}>
      <td className="px-2 py-2"><Input aria-label="Rule name" className="h-9 min-w-40" value={r.label} placeholder={rule ? '' : 'New rule…'} onChange={(e) => setR({ ...r, label: e.target.value })} /></td>
      <td className="px-2 py-2"><select aria-label="Reads" className={sel} value={r.factor} onChange={(e) => setR({ ...r, factor: e.target.value, operator: ['group_member', 'repeat_customer', 'referral'].includes(e.target.value) ? 'is_true' : ['segment', 'source', 'distance_band'].includes(e.target.value) ? 'in' : 'gte' })}>
        {Object.entries(FACTORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
      <td className="px-2 py-2"><select aria-label="When" className={sel} value={r.operator} onChange={(e) => setR({ ...r, operator: e.target.value })}>
        {Object.entries(OPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
      <td className="px-2 py-2"><Input aria-label="Value" className="num h-9 w-32" disabled={r.operator === 'is_true'} value={r.operator === 'is_true' ? '' : r.value} onChange={(e) => setR({ ...r, value: e.target.value })} /></td>
      <td className="px-2 py-2"><Input aria-label="Points" type="number" className="num h-9 w-20" value={r.points} onChange={(e) => setR({ ...r, points: Number(e.target.value) })} /></td>
      <td className="px-2 py-2"><input aria-label="Active" type="checkbox" className="size-4 accent-redux-blue" checked={r.is_active} onChange={(e) => setR({ ...r, is_active: e.target.checked })} /></td>
      <td className="px-2 py-2">
        <Button size="xs" variant={rule ? 'outline' : 'default'} disabled={pending || !dirty}
          onClick={() => run(() => saveScoringRuleAction({ ...r, id: r.id || undefined } as never), rule ? 'Rule saved' : 'Rule added', () => { if (!rule) setR(blank) })}>
          {pending ? <Loader2 className="animate-spin" /> : rule ? <Save aria-hidden /> : <Plus aria-hidden />}{rule ? 'Save' : 'Add'}
        </Button>
      </td>
    </tr>
  )
}

export function Thresholds({ a, b }: { a: number; b: number }) {
  const [v, setV] = useState({ a, b })
  const { pending, run } = useSave()
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="thr-a">Tier A from</Label><Input id="thr-a" type="number" className="num" value={v.a} onChange={(e) => setV({ ...v, a: Number(e.target.value) })} /></div>
        <div className="space-y-1.5"><Label htmlFor="thr-b">Tier B from</Label><Input id="thr-b" type="number" className="num" value={v.b} onChange={(e) => setV({ ...v, b: Number(e.target.value) })} /></div>
      </div>
      <p className="text-xs text-muted-ink">Points. Below tier B is tier C.</p>
      <Button size="sm" variant="outline" disabled={pending || (v.a === a && v.b === b)} onClick={() => run(() => saveThresholdsAction(v.a, v.b), 'Thresholds saved')}><Save aria-hidden /> Save</Button>
    </div>
  )
}

export function ServiceAreaRow({ area }: { area: { id: string; name: string; near_km: number; is_active: boolean } }) {
  const [km, setKm] = useState(area.near_km)
  const { pending, run } = useSave()
  return (
    <li className="flex items-end gap-2">
      <div className="flex-1 space-y-1.5"><Label htmlFor={`sa-${area.id}`}>{area.name} — radius (km)</Label><Input id={`sa-${area.id}`} type="number" className="num" value={km} onChange={(e) => setKm(Number(e.target.value))} /></div>
      <Button size="sm" variant="outline" disabled={pending || km === area.near_km} onClick={() => run(() => saveServiceAreaAction(area.id, km, area.is_active), 'Service area saved')}><Save aria-hidden /></Button>
    </li>
  )
}

type Policy = { tier: string; distance_band: string; mode: string; demo_offer: string; owner_role: string; followup_days: number; note: string | null }

export function PolicyCell({ policy, modeLabel, demoLabel }: { policy: Policy; modeLabel: string; demoLabel: string }) {
  const [open, setOpen] = useState(false)
  const [p, setP] = useState(policy)
  const { pending, run } = useSave()
  return (
    <>
      <button type="button" onClick={() => { setP(policy); setOpen(true) }} className="w-full rounded-md p-2 text-left ring-1 ring-line hover:bg-surface">
        <span className="block font-medium text-ink">{modeLabel}</span>
        <span className="block text-xs text-muted-ink">{demoLabel} · follow up {policy.followup_days} d{policy.owner_role === 'sales' ? ' · sales owner' : ''}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tier {policy.tier} · {policy.distance_band === 'near' ? 'inside the service area' : policy.distance_band === 'far' ? 'outside' : 'location unknown'}</DialogTitle>
            <DialogDescription>Applies to leads scored from now on, and to open leads when you rescore. Leads the team has overridden keep their choice.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="pol-mode">Assessment</Label><select id="pol-mode" className={`${sel} w-full`} value={p.mode} onChange={(e) => setP({ ...p, mode: e.target.value })}>{Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="pol-demo">Demo offer</Label><select id="pol-demo" className={`${sel} w-full`} value={p.demo_offer} onChange={(e) => setP({ ...p, demo_offer: e.target.value })}>{Object.entries(DEMO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="pol-owner">Owner</Label><select id="pol-owner" className={`${sel} w-full`} value={p.owner_role} onChange={(e) => setP({ ...p, owner_role: e.target.value })}><option value="cc_exec">Care executive</option><option value="sales">Dedicated sales owner</option></select></div>
            <div className="space-y-1.5"><Label htmlFor="pol-fu">Follow up every (days)</Label><Input id="pol-fu" type="number" className="num" value={p.followup_days} onChange={(e) => setP({ ...p, followup_days: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter><Button disabled={pending} onClick={() => run(() => savePolicyAction(p as never), 'Policy saved', () => setOpen(false))}>{pending && <Loader2 className="animate-spin" />} Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RescoreAllButton() {
  const { pending, run } = useSave()
  return <Button size="sm" disabled={pending} onClick={() => run(async () => { const r = await rescoreAllAction(); if (r.ok) toast.message(`${r.data.count} open leads rescored`); return r }, 'Done')}>{pending ? <Loader2 className="animate-spin" /> : <RefreshCw aria-hidden />} Rescore open leads</Button>
}

export function ScorePreview({ segments }: { segments: { code: string; name: string }[] }) {
  const [f, setF] = useState({ units: '', value: '', segment: 'hotel', pincode: '', group_member: false, repeat_customer: false, referral: false })
  const [res, setRes] = useState<Preview | null>(null)
  const [pending, start] = useTransition()
  const test = () => start(async () => {
    const r = await previewScoreAction({ ...f, units: f.units === '' ? undefined : Number(f.units), value: f.value === '' ? undefined : Number(f.value) })
    if (r.ok) setRes(r.data); else toast.error(r.message)
  })
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="pv-u">Rooms</Label><Input id="pv-u" type="number" className="num" value={f.units} onChange={(e) => setF({ ...f, units: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="pv-v">Value (₹)</Label><Input id="pv-v" type="number" className="num" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="pv-s">Segment</Label><select id="pv-s" className={`${sel} w-full`} value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })}>{segments.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="pv-p">Pincode</Label><Input id="pv-p" inputMode="numeric" className="num" value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value })} placeholder="110001" /></div>
      </div>
      <div className="flex flex-wrap gap-3">
        {([['group_member', 'Hotel chain'], ['repeat_customer', 'Existing customer'], ['referral', 'Referred']] as const).map(([k, l]) => (
          <label key={k} className="inline-flex items-center gap-1.5"><input type="checkbox" className="size-4 accent-redux-blue" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{l}</label>
        ))}
      </div>
      <Button size="sm" variant="outline" disabled={pending} onClick={test}>{pending && <Loader2 className="animate-spin" />} Score it</Button>
      {res && (
        <div className="rounded-md bg-surface p-3">
          <p className="font-semibold text-ink">Tier {res.tier} · <span className="num">{res.score}</span> points</p>
          <p className="text-xs text-muted-ink">{res.band === 'near' ? 'Inside the service area' : res.band === 'far' ? 'Outside the service area' : 'Location unknown'}{res.km !== null ? ` · ${Math.round(res.km)} km` : ''}</p>
          <ul className="mt-2 space-y-0.5 text-xs">{res.breakdown.length ? res.breakdown.map((b, i) => <li key={i} className="flex justify-between"><span>{b.label}</span><span className="num">+{b.points}</span></li>) : <li className="text-muted-ink">No rule matched.</li>}</ul>
        </div>
      )}
    </div>
  )
}
