'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createLeadAction } from '@/lib/actions/leads'
import { cn } from 'cn'

export function NewLeadForm({ cities }: { cities: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [type, setType] = useState<'hotel' | 'home' | 'dealer'>('hotel')
  const [source, setSource] = useState<'call' | 'walk_in'>('call')
  const [marketing, setMarketing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit(form: FormData) {
    setError(null)
    start(async () => {
      const r = await createLeadAction({
        phone: form.get('phone'), name: form.get('name'), email: form.get('email'), source, customer_type: type,
        city_id: form.get('city') || undefined, property_name: form.get('property') || undefined,
        unit_count: form.get('units') || undefined, marketing,
      })
      if (!r.ok) { setError(r.message); return }
      toast.success(r.data.created ? 'Lead created and assigned to you' : 'This number already has an open lead — the enquiry was added to it')
      router.push(`/staff/leads/${r.data.leadId}`)
    })
  }

  return (
    <form action={submit} className="max-w-2xl space-y-6 rounded-lg border border-line bg-white p-6 shadow-card">
      <Choice label="How did they reach us?" value={source} onChange={(v) => setSource(v as 'call' | 'walk_in')} options={[['call', 'Phone call'], ['walk_in', 'Walk-in']]} />
      <Choice label="Who are they?" value={type} onChange={(v) => setType(v as 'hotel' | 'home' | 'dealer')} options={[['hotel', 'Hotel'], ['home', 'Home'], ['dealer', 'Dealer']]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Contact name" required />
        <Field id="phone" label="Mobile number" required inputMode="tel" placeholder="98100 00000" hint="Any format — it is stored as +91…, and a repeat caller joins their open lead" />
        <Field id="property" label={type === 'hotel' ? 'Hotel name' : type === 'dealer' ? 'Firm name' : 'Residence (optional)'} />
        {type !== 'dealer' && <Field id="units" label={type === 'hotel' ? 'Rooms' : 'Bathrooms'} inputMode="numeric" />}
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <select id="city" name="city" className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-redux-blue">
            <option value="">Choose…</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Field id="email" label="Email (optional)" type="email" />
      </div>
      <div className="rounded-md bg-surface p-4 text-sm">
        <p className="font-medium text-ink">Consent, captured on the call (DPDP)</p>
        <p className="mt-1 text-muted-ink">Read them the notice: we use their number to arrange the free assessment. Service contact is recorded as given verbally.</p>
        <label className="mt-3 flex items-center gap-2">
          <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} /> They also agreed to offers and updates (marketing)
        </label>
      </div>
      {error && <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <UserPlus aria-hidden />} Create lead</Button>
    </form>
  )
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            className={cn('rounded-md border px-4 py-2 text-sm font-semibold', value === v ? 'border-redux-blue bg-redux-blue text-white' : 'border-line bg-white text-ink hover:border-redux-blue')}>{l}</button>
        ))}
      </div>
    </fieldset>
  )
}

function Field({ id, label, hint, ...rest }: { id: string; label: string; hint?: string } & React.ComponentProps<'input'>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} className="h-10" aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-ink">{hint}</p>}
    </div>
  )
}
