import type { Metadata } from 'next'
import { PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'
import { CampaignBuilder } from '../campaign-controls'

export const metadata: Metadata = { title: 'New campaign' }

// E26 (D32) — build a campaign: message (marketing templates only), audience with a live count
export default async function NewCampaignPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const today = new Date(nowMs()).toISOString().slice(0, 10)
  const [{ data: templates }, { data: offers }, { data: reasons }, { data: segments }, { data: cities }] = await Promise.all([
    supabase.from('message_templates').select('code, channel, body, variables').eq('category', 'marketing').eq('is_active', true).order('code'),
    supabase.from('offers').select('id, code, title, discount_pct, valid_until').eq('is_active', true).gte('valid_until', today).order('code'),
    supabase.from('lost_reasons').select('id, name').eq('is_active', true).order('sort_order'),
    supabase.from('segments').select('code, name').eq('is_b2c', false).eq('is_active', true).order('sort_order'),
    supabase.from('cities').select('id, name').eq('is_active', true).order('name'),
  ])
  return (
    <>
      <PageHeader back={{ href: '/staff/campaigns', label: 'Campaigns' }} title="New campaign"
        description="Only people with live marketing consent receive it. The number on the right is exactly how many will." />
      <CampaignBuilder templates={(templates ?? []).map((t) => ({ ...t, variables: t.variables as string[] }))}
        offers={(offers ?? []).map((o) => ({ ...o, discount_pct: Number(o.discount_pct) }))}
        lostReasons={reasons ?? []} segments={segments ?? []} cities={cities ?? []} />
    </>
  )
}
