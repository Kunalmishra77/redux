import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { InvoiceDocument } from '@/components/features/invoices/invoice-document'
import { requirePortalUser } from '@/lib/data/portal'
import { loadInvoice } from '@/lib/data/invoices'
import { PayButton } from '../pay-button'
import { PrintButton } from '@/components/patterns/print-button'

export const metadata: Metadata = { title: 'Invoice' }

export default async function PortalInvoice({ params }: PageProps<'/portal/invoices/[id]'>) {
  await requirePortalUser()
  const { id } = await params
  const inv = await loadInvoice(id)
  if (!inv) notFound()
  const due = Number(inv.total) - Number(inv.amount_paid)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/portal/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Invoices</Link>
        <div className="flex gap-2">
          <PrintButton>Download PDF</PrintButton>
          {due > 0 && (inv.status === 'issued' || inv.status === 'part_paid') && <PayButton invoiceId={id} due={due} route={inv.payment_route} />}
        </div>
      </div>
      <div className="overflow-x-auto"><InvoiceDocument inv={inv} /></div>
    </div>
  )
}
