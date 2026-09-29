'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, CheckCircle2, Loader2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { simulatePaymentAction } from '@/lib/actions/invoices'
import { formatInr } from '@/lib/services/money'

// D6s "Pay now". Production opens the Razorpay link (or shows the virtual account for NEFT/RTGS,
// BR-I6); the webhook records the payment. The demo simulates the same capture.
export function PayButton({ invoiceId, due, route }: { invoiceId: string; due: number; route: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [paid, setPaid] = useState(false)
  const [pending, start] = useTransition()
  const bank = route === 'virtual_account'
  const pay = () => start(async () => {
    const r = await simulatePaymentAction(invoiceId, Math.round(due * 100) / 100)
    if (r.ok) { setPaid(true); router.refresh() } else toast.error(r.message)
  })
  return (
    <>
      <Button onClick={() => { setPaid(false); setOpen(true) }}>{bank ? 'Bank details' : 'Pay now'}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {paid ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden />
              <DialogTitle className="mt-3 text-xl">Payment received</DialogTitle>
              <DialogDescription className="mt-1">Thank you. Your receipt is on WhatsApp and the invoice is updated.</DialogDescription>
              <Button className="mt-5" onClick={() => setOpen(false)}>Done</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Pay {formatInr(due.toFixed(2), 'auto')}</DialogTitle>
                <DialogDescription>{bank ? 'For larger invoices we use a dedicated bank account — no card fees. Transfers match this invoice automatically.' : 'Secure payment by Razorpay: UPI, card or netbanking.'}</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-line p-4">
                {bank ? (
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-ink">Account name</dt><dd className="font-medium">REDUX Bath Restorations</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-ink">Account no.</dt><dd className="num font-medium">2223330012345678</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-ink">IFSC</dt><dd className="num font-medium">RATN0VAAPIS</dd></div>
                    <p className="pt-2 text-xs text-faint">Demo details — a real virtual account is created per invoice.</p>
                  </dl>
                ) : (
                  <p className="flex items-center gap-3 text-sm"><Smartphone className="size-5 text-redux-blue" aria-hidden /> UPI · Cards · Netbanking</p>
                )}
              </div>
              <DialogFooter>
                <Button size="lg" className="w-full" disabled={pending} onClick={pay}>
                  {pending ? <Loader2 className="animate-spin" /> : bank ? <Building2 aria-hidden /> : null} {bank ? 'Simulate the bank transfer' : `Pay ${formatInr(due.toFixed(2), 'auto')}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
