import type { Metadata } from 'next'
import { PageHeader } from '@/components/patterns'
import { PipelineBoard, type BoardCard } from '@/components/features/leads/board'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { LEAD_COLUMNS, loadPickLists, type LeadRow } from '@/lib/data/leads'

export const metadata: Metadata = { title: 'Pipeline' }

export default async function BoardPage() {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const supabase = await createClient()
  let q = supabase.from('leads').select(LEAD_COLUMNS).order('created_at', { ascending: false })
  if (user.role === 'cc_exec') q = q.eq('assigned_to', user.id)
  const [{ data }, lists] = await Promise.all([q, loadPickLists()])
  const leads = (data ?? []) as unknown as LeadRow[]
  const cards: BoardCard[] = leads.filter((l) => l.status !== 'lost').map((l) => ({
    id: l.id, status: l.status, source: l.source?.code ?? '',
    title: l.property_name ?? l.name ?? l.phone,
    line: [l.customer_type === 'hotel' ? `${l.unit_count ?? '?'} rooms` : l.customer_type === 'home' ? 'Home' : 'Dealer', l.city?.name, l.owner?.full_name].filter(Boolean).join(' · '),
  }))
  return (
    <>
      <PageHeader title="Pipeline" description="New → Won. Drag a card, or use its Move menu. Later stages follow the work itself." />
      <PipelineBoard cards={cards} lostCount={leads.filter((l) => l.status === 'lost').length}
        reasons={lists.lostReasons.map((r) => ({ code: r.code, name: r.name, requiresNote: !!r.requiresNote }))} />
    </>
  )
}
