import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lock, Printer } from 'lucide-react'
import { PrintButton } from '@/components/patterns/print-button'
import { AssessmentReport, CompletionReport, WarrantyCertificate } from '@/components/features/reports/report-documents'
import { requirePortalUser } from '@/lib/data/portal'
import { loadAssessmentReport, loadJobReport } from '@/lib/data/reports'

export const metadata: Metadata = { title: 'Report' }

const TITLE = { assessment: 'Assessment report', completion: 'Completion report', warranty: 'Warranty certificate' } as const

// CR-001 phase 2 (D25) — customer reports. BR-B2: available to verified accounts.
export default async function ReportPage({ params }: PageProps<'/portal/reports/[kind]/[id]'>) {
  const { kind, id } = await params
  if (!(kind in TITLE)) notFound()
  const user = await requirePortalUser()
  const noun = user.customers[0]?.type === 'home' ? 'Bathroom' : 'Room'
  if (!user.verified) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-line bg-white p-8 text-center shadow-card">
        <Lock className="mx-auto size-6 text-redux-blue" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-ink">{TITLE[kind as keyof typeof TITLE]}</h1>
        <p className="mt-1 text-sm text-muted-ink">Reports open once REDUX has verified your account. We’ll let you know on WhatsApp.</p>
      </div>
    )
  }
  let doc: React.ReactNode = null
  if (kind === 'assessment') {
    const r = await loadAssessmentReport(id)
    if (!r) notFound()
    doc = <AssessmentReport r={r} noun={noun} />
  } else {
    const r = await loadJobReport(id)
    if (!r || r.job.status !== 'completed') notFound()
    doc = kind === 'completion' ? <CompletionReport r={r} noun={noun} /> : <WarrantyCertificate r={r} noun={noun} />
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/portal/history?tab=work" className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> History</Link>
        <PrintButton><Printer aria-hidden /> Download PDF</PrintButton>
      </div>
      <h1 className="sr-only">{TITLE[kind as keyof typeof TITLE]}</h1>
      <div className="overflow-x-auto">{doc}</div>
    </div>
  )
}
