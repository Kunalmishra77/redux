import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Printer } from 'lucide-react'
import { PageHeader } from '@/components/patterns'
import { PrintButton } from '@/components/patterns/print-button'
import { AssessmentReport, CompletionReport, WarrantyCertificate } from '@/components/features/reports/report-documents'
import { requireRole } from '@/lib/auth/session'
import { loadAssessmentReport, loadJobReport } from '@/lib/data/reports'

export const metadata: Metadata = { title: 'Report' }

const TITLE = { assessment: 'Assessment report', completion: 'Completion report', warranty: 'Warranty certificate' } as const

// E20 (D26) — the same customer reports, opened from the account 360° so the team sees exactly what
// the customer sees. Access is the staff member's own RLS (loadAssessmentReport / loadJobReport).
export default async function StaffReportPage({ params, searchParams }: PageProps<'/staff/reports/[kind]/[id]'>) {
  await requireRole(['super_admin', 'cc_exec'])
  const { kind, id } = await params
  const { from } = await searchParams
  if (!(kind in TITLE)) notFound()
  let doc: React.ReactNode = null
  let customerId: string | null = null
  if (kind === 'assessment') {
    const r = await loadAssessmentReport(id)
    if (!r) notFound()
    const noun = r.survey.property?.customer?.type === 'home' ? 'Bathroom' : 'Room'
    doc = <AssessmentReport r={r} noun={noun} />
    customerId = r.customerId
  } else {
    const r = await loadJobReport(id)
    if (!r || r.job.status !== 'completed') notFound()
    const noun = r.job.property?.customer?.type === 'home' ? 'Bathroom' : 'Room'
    doc = kind === 'completion' ? <CompletionReport r={r} noun={noun} /> : <WarrantyCertificate r={r} noun={noun} />
    customerId = r.customerId
  }
  const back = typeof from === 'string' && from.startsWith('/staff/') ? from : customerId ? `/staff/accounts/${customerId}?tab=assessments` : '/staff/accounts'
  return (
    <>
      <div className="print:hidden">
        <PageHeader back={{ href: back, label: 'Account' }} title={TITLE[kind as keyof typeof TITLE]}
          actions={<PrintButton><Printer aria-hidden /> Download PDF</PrintButton>} />
      </div>
      <div className="overflow-x-auto">{doc}</div>
    </>
  )
}
