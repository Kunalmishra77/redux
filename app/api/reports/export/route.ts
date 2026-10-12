import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { isReportKind, loadReport, pick, rangeDays, REPORTS, type ReportDef } from '@/lib/data/lifecycle-reports'
import { toCsv } from '@/lib/services/csv'
import { nowMs } from '@/lib/services/clock'

// CR-001 phase 10 (D33) — CSV of any report table: /api/reports/export?kind=tiers&table=by_tier&days=90.
// Super Admin only; the database function enforces it again.
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.role !== 'super_admin') return NextResponse.json({ message: 'Reports are for the Super Admin' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const kind = sp.get('kind')
  if (!isReportKind(kind)) return NextResponse.json({ message: 'Unknown report' }, { status: 400 })
  const def: ReportDef = REPORTS[kind]
  const table = def.tables.find((t) => t.key === sp.get('table'))
  if (!table) return NextResponse.json({ message: 'Unknown table' }, { status: 400 })
  const days = rangeDays(sp.get('days'))
  const { data, error } = await loadReport(kind, days)
  if (error || !data) return NextResponse.json({ message: 'The report could not be prepared' }, { status: 500 })
  const rows = (pick(data, table.key) ?? []) as Record<string, unknown>[]
  const stamp = new Date(nowMs()).toISOString().slice(0, 10)
  return new NextResponse(toCsv(rows, table.columns), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="redux-${kind}-${table.key}${def.since ? `-${days}d` : ''}-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
