import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { QuoteDocument } from '@/components/features/quotes/quote-document'
import { requireRole } from '@/lib/auth/session'
import { loadQuote, loadSupplier } from '@/lib/data/quotes'
import { PrintButton } from './print-button'

export const metadata: Metadata = { title: 'Quotation preview' }

// B20 — the exact HTML Gotenberg renders into the PDF (ADR-010). No app chrome: it IS the document.
export default async function QuotePreviewPage({ params }: PageProps<'/staff/quotes/[id]/preview'>) {
  await requireRole(['super_admin', 'surveyor', 'cc_exec'])
  const { id } = await params
  const [q, supplier] = await Promise.all([loadQuote(id), loadSupplier()])
  if (!q) notFound()
  return (
    <div className="min-h-screen bg-surface py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2 print:hidden">
        <Link href={`/staff/quotes/${id}`} className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Back to the quote</Link>
        <PrintButton><Printer aria-hidden /> Print / save PDF</PrintButton>
      </div>
      <QuoteDocument q={q} supplier={supplier} />
    </div>
  )
}
