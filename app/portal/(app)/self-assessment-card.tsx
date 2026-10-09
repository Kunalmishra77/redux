'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startMySelfAssessmentAction } from '@/lib/actions/self-assessment'

// CR-001 phase 4 (D27) — "Start your self-assessment" on the portal home
export function StartSelfAssessmentButton({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition()
  return (
    <Button disabled={pending} onClick={() => start(async () => {
      const r = await startMySelfAssessmentAction(leadId)
      if (r && !r.ok) toast.error(r.message)
    })}>{pending ? <Loader2 className="animate-spin" /> : <Camera aria-hidden />} Start</Button>
  )
}
