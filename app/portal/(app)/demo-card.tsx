'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { rateMyDemoAction } from '@/lib/actions/demos'

// CR-001 phase 5 (D28) — the customer rates a finished demo from the portal home
export function RateDemo({ demoId }: { demoId: string }) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [pending, start] = useTransition()
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}>
            <Star className={`size-7 ${n <= rating ? 'fill-warning text-warning' : 'text-faint'}`} aria-hidden />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How does it look and work now? (optional)" aria-label="Your comment" />
          <Button size="sm" disabled={pending} onClick={() => start(async () => {
            const r = await rateMyDemoAction(demoId, rating, comment)
            if (r.ok) { toast.success('Thank you'); router.refresh() } else toast.error(r.message)
          })}>{pending && <Loader2 className="animate-spin" />} Send</Button>
        </>
      )}
    </div>
  )
}
