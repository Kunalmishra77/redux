'use client'

import { useState } from 'react'
import { Check, Copy, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// CR-001 phase 6 (D29) — copy or WhatsApp the referral link (the customer sends it themselves)
export function ShareLink({ link, code, business }: { link: string; code: string; business: string }) {
  const [copied, setCopied] = useState(false)
  const text = `We had our bathroom fittings restored by REDUX instead of replacing them — ${business}. Register with my code ${code} for your first order: ${link}`
  return (
    <div className="mt-4 space-y-3">
      <p className="num break-all rounded-md bg-surface px-3 py-2 text-sm text-ink">{link}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ } }}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button asChild><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden /> Share on WhatsApp</a></Button>
      </div>
    </div>
  )
}
