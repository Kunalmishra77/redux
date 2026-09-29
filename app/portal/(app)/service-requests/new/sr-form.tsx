'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { raiseServiceRequestAction } from '@/lib/actions/portal'

type Unit = { id: string; label: string; propertyId: string | null; customerId: string }
type Warranty = { id: string; unitId: string; label: string }

export function SrForm({ customers, units, warranties, initialWarranty }: { customers: { id: string; name: string }[]; units: Unit[]; warranties: Warranty[]; initialWarranty?: string }) {
  const router = useRouter()
  const w0 = warranties.find((w) => w.id === initialWarranty)
  const [customer, setCustomer] = useState(customers[0]?.id ?? '')
  const [unit, setUnit] = useState(w0?.unitId ?? '')
  const [warranty, setWarranty] = useState(w0?.id ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const myUnits = units.filter((u) => u.customerId === customer)
  const myWarranties = warranties.filter((w) => !unit || w.unitId === unit)
  const submit = () => start(async () => {
    const u = units.find((x) => x.id === unit)
    const r = await raiseServiceRequestAction({ customer_id: customer, property_id: u?.propertyId ?? undefined, job_unit_id: unit || undefined, warranty_id: warranty || undefined, subject, body })
    if (!r.ok) { toast.error(r.message); return }
    toast.success(`Request ${r.data.requestNo} sent — we’ll be in touch`)
    router.push('/portal/service-requests')
  })
  return (
    <form className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-card" onSubmit={(e) => { e.preventDefault(); submit() }}>
      {customers.length > 1 && (
        <div className="space-y-1.5"><Label htmlFor="sr-cust">Account</Label>
          <Select value={customer} onValueChange={(v) => { setCustomer(v); setUnit(''); setWarranty('') }}>
            <SelectTrigger id="sr-cust" className="h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select></div>
      )}
      {myUnits.length > 0 && (
        <div className="space-y-1.5"><Label htmlFor="sr-unit">Which room or bathroom?</Label>
          <Select value={unit || 'none'} onValueChange={(v) => { setUnit(v === 'none' ? '' : v); setWarranty('') }}>
            <SelectTrigger id="sr-unit" className="h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">Not sure / general</SelectItem>{myUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
          </Select></div>
      )}
      {myWarranties.length > 0 && (
        <div className="space-y-1.5"><Label htmlFor="sr-w">Warranty claim? (optional)</Label>
          <Select value={warranty || 'none'} onValueChange={(v) => setWarranty(v === 'none' ? '' : v)}>
            <SelectTrigger id="sr-w" className="h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">No — general help</SelectItem>{myWarranties.map((w) => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}</SelectContent>
          </Select></div>
      )}
      <div className="space-y-1.5"><Label htmlFor="sr-subject">What’s wrong?</Label>
        <Input id="sr-subject" className="h-11" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Basin mixer dripping" maxLength={200} /></div>
      <div className="space-y-1.5"><Label htmlFor="sr-body">Anything else we should know? (optional)</Label>
        <Textarea id="sr-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="When it started, how often…" /></div>
      <Button type="submit" size="lg" className="w-full" disabled={pending || subject.trim().length < 3 || !customer}>{pending && <Loader2 className="animate-spin" />} Send request</Button>
    </form>
  )
}
