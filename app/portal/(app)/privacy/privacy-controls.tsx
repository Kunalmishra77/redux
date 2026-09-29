'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Loader2, PencilLine, Trash2, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createDsrAction, exportMyDataAction, withdrawMarketingAction } from '@/lib/actions/portal'

export function PrivacyControls({ customers, marketingOn }: { customers: { id: string; name: string }[]; marketingOn: boolean }) {
  const router = useRouter()
  const customer = customers[0]?.id
  const [dialog, setDialog] = useState<'correction' | 'erasure' | null>(null)
  const [details, setDetails] = useState('')
  const [pending, start] = useTransition()
  if (!customer) return null

  const download = () => start(async () => {
    const r = await exportMyDataAction(customer)
    if (!r.ok) { toast.error(r.message); return }
    const url = URL.createObjectURL(new Blob([r.data.json], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'my-redux-data.json' })
    a.click()
    URL.revokeObjectURL(url)
  })
  const withdraw = () => start(async () => {
    const r = await withdrawMarketingAction(customer)
    if (r.ok) { toast.success('Done — no more offers from REDUX. Service messages continue.'); router.refresh() } else toast.error(r.message)
  })
  const request = () => start(async () => {
    const r = await createDsrAction(dialog!, customer, details)
    if (r.ok) { toast.success('Request logged — we’ll reply within 30 days'); setDialog(null); setDetails(''); router.refresh() } else toast.error(r.message)
  })

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <Action icon={Download} title="Download my data" body="Everything we hold about your account, as a file." onClick={download} disabled={pending} />
      <Action icon={PencilLine} title="Correct something" body="A wrong name, number or address." onClick={() => setDialog('correction')} disabled={pending} />
      {marketingOn && <Action icon={BellOff} title="Stop marketing messages" body="You’ll still get updates about your job." onClick={withdraw} disabled={pending} />}
      <Action icon={Trash2} title="Erase my data" body="What we can erase, we will. Some records must be kept by law." onClick={() => setDialog('erasure')} danger disabled={pending} />
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === 'erasure' ? 'Erase my data' : 'Correct my data'}</DialogTitle>
            <DialogDescription>
              {dialog === 'erasure'
                ? 'We will erase your personal data except what the law requires us to keep: GST invoices and payment records (at least 6 years) and approval records for work we carried out. We’ll tell you exactly what was kept and why.'
                : 'Tell us what’s wrong and what it should be.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="dsr-d">{dialog === 'erasure' ? 'Anything we should know? (optional)' : 'What should we correct?'}</Label>
            <Textarea id="dsr-d" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
          <DialogFooter>
            <Button variant={dialog === 'erasure' ? 'destructive' : 'default'} disabled={pending || (dialog === 'correction' && !details.trim())} onClick={request}>
              {pending && <Loader2 className="animate-spin" />} {dialog === 'erasure' ? 'Request erasure' : 'Send correction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Action({ icon: Icon, title, body, onClick, danger, disabled }: { icon: typeof Download; title: string; body: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-start gap-3 rounded-xl border border-line bg-white p-4 text-left shadow-card transition hover:border-redux-blue/40 disabled:opacity-60">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-danger-bg text-danger' : 'bg-pale text-redux-blue'}`}><Icon className="size-5" aria-hidden /></span>
      <span><span className="block font-semibold text-ink">{title}</span><span className="text-sm text-muted-ink">{body}</span></span>
    </button>
  )
}
