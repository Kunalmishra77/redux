'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { completeFollowUpAction } from '@/lib/actions/leads'

export function DoneButton({ id, leadId }: { id: string; leadId?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await completeFollowUpAction(id, leadId)
      if (r.ok) { toast.success('Done'); router.refresh() } else toast.error(r.message)
    })}><Check aria-hidden /> Done</Button>
  )
}
