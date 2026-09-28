'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { raiseInvoiceAction } from '@/lib/actions/invoices'

export function RaiseInvoiceButton({ jobId }: { jobId: string }) {
  const [pending, start] = useTransition()
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
      const r = await raiseInvoiceAction(jobId)
      if (r && !r.ok) toast.error(r.message)
    })}>{pending ? <Loader2 className="animate-spin" /> : <Receipt aria-hidden />} Raise invoice</Button>
  )
}
