import type { Metadata } from 'next'
import { Sparkles } from 'lucide-react'
import { BeforeAfter } from '@/components/patterns'
import { requirePortalUser } from '@/lib/data/portal'
import { loadRestoredFittings } from '@/lib/data/portal-fittings'

export const metadata: Metadata = { title: 'My fittings' }

// D4s — every fitting, before and after, room by room.
export default async function FittingsPage() {
  await requirePortalUser()
  const all = await loadRestoredFittings()
  const units = [...new Set(all.map((f) => f.unit ?? 'Other'))]
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My fittings</h1>
        <p className="mt-1 text-sm text-muted-ink">Before REDUX and after — photographed by our team at the survey and at handover.</p>
      </div>
      {all.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted-ink"><Sparkles className="mx-auto mb-2 size-6 text-redux-blue" aria-hidden />Your fittings appear here once a job starts.</div>
      ) : units.map((u) => (
        <section key={u}>
          <h2 className="mb-3 font-semibold text-ink">{u}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {all.filter((f) => (f.unit ?? 'Other') === u).map((f) => (
              <div key={f.id} className="rounded-xl border border-line bg-white p-3 shadow-card">
                <BeforeAfter before={f.before} after={f.after} caption={`${f.name}${f.work ? ` — ${f.work.toLowerCase()}` : ''}`} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
