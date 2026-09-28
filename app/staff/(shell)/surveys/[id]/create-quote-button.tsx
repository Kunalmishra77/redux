'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createQuoteAction } from '@/lib/actions/quotes'

// B17's primary action: the quotation is built from the audit — never re-typed (D10-01)
export function CreateQuoteButton({ surveyId }: { surveyId: string }) {
  const [pending, start] = useTransition()
  return (
    <Button size="lg" disabled={pending} onClick={() => start(async () => {
      const r = await createQuoteAction(surveyId)
      if (r && !r.ok) toast.error(r.message)
    })}>
      {pending ? <Loader2 className="animate-spin" /> : <FileText aria-hidden />} Create quotation
    </Button>
  )
}
