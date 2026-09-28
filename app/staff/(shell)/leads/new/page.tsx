import type { Metadata } from 'next'
import { PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { NewLeadForm } from './new-lead-form'

export const metadata: Metadata = { title: 'New lead' }

// B9 — calls and walk-ins (D3: "manual entry for calls and walk-ins"), through the same
// ingest_lead() path as every other source, so dedup and assignment hold.
export default async function NewLeadPage() {
  await requireRole(['super_admin', 'cc_exec'])
  const supabase = await createClient()
  const { data: cities } = await supabase.from('cities').select('id, name').eq('is_active', true).order('name')
  return (
    <>
      <PageHeader title="New lead" description="For phone calls and walk-ins. Web, Meta, Google and WhatsApp leads arrive on their own." />
      <NewLeadForm cities={cities ?? []} />
    </>
  )
}
