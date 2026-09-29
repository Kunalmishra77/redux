import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requirePortalUser } from '@/lib/data/portal'
import { SrForm } from './sr-form'

export const metadata: Metadata = { title: 'Raise a service request' }

// D8s — pick the room and, if it's a warranty claim, the card; describe it in a sentence.
export default async function NewRequest({ searchParams }: PageProps<'/portal/service-requests/new'>) {
  const user = await requirePortalUser()
  const { warranty } = await searchParams
  const supabase = await createClient()
  const [{ data: units }, { data: warranties }] = await Promise.all([
    supabase.from('job_units').select('id, pu:property_units(label, property_id), job:jobs(customer_id)'),
    supabase.from('warranties').select('id, card_no, kind, job_unit_id, fitting:fittings(ft:fitting_types(name))'),
  ])
  const unitOpts = ((units ?? []) as unknown as { id: string; pu: { label: string; property_id: string } | null; job: { customer_id: string } | null }[])
    .map((u) => ({ id: u.id, label: u.pu?.label ?? '—', propertyId: u.pu?.property_id ?? null, customerId: u.job?.customer_id ?? '' }))
  const warrantyOpts = ((warranties ?? []) as unknown as { id: string; card_no: string; kind: string; job_unit_id: string; fitting: { ft: { name: string } | null } | null }[])
    .map((w) => ({ id: w.id, unitId: w.job_unit_id, label: `${w.fitting?.ft?.name ?? 'Fitting'} · ${w.kind} · ${w.card_no}` }))
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/portal/service-requests" className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Service requests</Link>
      <div>
        <h1 className="text-2xl font-semibold text-ink">Raise a service request</h1>
        <p className="mt-1 text-sm text-muted-ink">We acknowledge within a working day and tell you when someone will visit.</p>
      </div>
      <SrForm customers={user.customers} units={unitOpts} warranties={warrantyOpts} initialWarranty={typeof warranty === 'string' ? warranty : undefined} />
    </div>
  )
}
