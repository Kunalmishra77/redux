import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import { formatInr, type PaiseDisplay } from '@/lib/services/money'

// Composed patterns — blueprint/04-design/01-design-system.md §4–§5. Each one encodes a rule so
// screens cannot drift from it.

// ── Icon in a filled circle: the visual motif (§4) ─────────────────────────────
export function IconCircle({ icon: Icon, tone = 'pale', size = 'md', className }: {
  icon: LucideIcon
  tone?: 'pale' | 'lime' | 'blue' | 'warning' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const tones = {
    pale: 'bg-select text-redux-blue',
    lime: 'bg-redux-lime text-redux-blue',
    blue: 'bg-redux-blue text-white',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
    success: 'bg-[#e3f5ea] text-success',
  }
  const sizes = { sm: 'size-8 [&_svg]:size-4', md: 'size-10 [&_svg]:size-5', lg: 'size-14 [&_svg]:size-7' }
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full', tones[tone], sizes[size], className)}>
      <Icon aria-hidden />
    </span>
  )
}

// ── Status pill: never colour alone — always the word (§9) ────────────────────
export type PillTone = 'positive' | 'progress' | 'waiting' | 'neutral' | 'done' | 'failed'
const PILL: Record<PillTone, string> = {
  positive: 'bg-redux-lime text-redux-blue',
  progress: 'bg-redux-blue text-white',
  waiting: 'bg-warning-bg text-warning',
  neutral: 'bg-white text-muted-ink ring-1 ring-inset ring-line',
  done: 'bg-ink text-white',
  failed: 'bg-danger-bg text-danger',
}
export function StatusPill({ tone, children, className }: { tone: PillTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap', PILL[tone], className)}>
      {children}
    </span>
  )
}

// Domain status → pill tone, one mapping for every screen
export const LEAD_STATUS: Record<string, { label: string; tone: PillTone }> = {
  new: { label: 'New', tone: 'positive' },
  contacted: { label: 'Contacted', tone: 'progress' },
  survey_booked: { label: 'Survey booked', tone: 'waiting' },
  surveyed: { label: 'Surveyed', tone: 'progress' },
  quoted: { label: 'Quoted', tone: 'waiting' },
  won: { label: 'Won', tone: 'positive' },
  lost: { label: 'Lost', tone: 'failed' },
}

// ── Money: ₹1,23,456, tabular (§2, rule 5) ────────────────────────────────────
export function Money({ value, paise = 'auto', className }: { value: string | number | null | undefined; paise?: PaiseDisplay; className?: string }) {
  if (value === null || value === undefined || value === '') return <span className={cn('num text-faint', className)}>—</span>
  return <span className={cn('num', className)}>{formatInr(String(value), paise)}</span>
}

// ── Empty state: icon + one sentence + the primary action (§5) ────────────────
export function EmptyState({ icon, title, body, action }: {
  icon: LucideIcon
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center">
      <IconCircle icon={icon} size="lg" />
      <div className="max-w-sm">
        <p className="font-semibold text-ink">{title}</p>
        {body && <p className="mt-1 text-sm text-muted-ink">{body}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow text-redux-blue">{eyebrow}</p>}
        <h1 className="mt-1 text-[28px] leading-tight font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-ink">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── Card (§5: white, 1 px line, radius-md, the single shadow) ─────────────────
export function Panel({ title, action, children, className, bodyClassName }: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('rounded-lg border border-line bg-white shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
export function Kpi({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-muted-ink">{label}</p>
        {icon && <IconCircle icon={icon} size="sm" />}
      </div>
      <p className="num mt-2 text-[28px] leading-none font-semibold text-ink">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-ink">{hint}</p>}
    </div>
  )
}

// ── Stage tracker: 7 dots; done = blue, current = lime, pending = line (§5) ───
export const JOB_STAGES = [
  { key: 'dates_confirmed', label: 'Dates confirmed' },
  { key: 'removal_pickup', label: 'Removal & pickup' },
  { key: 'at_eurobrass', label: 'At Eurobrass' },
  { key: 'quality_check', label: 'Quality check' },
  { key: 'refit_test', label: 'Refit & test' },
  { key: 'handover', label: 'Handover' },
  { key: 'warranty_active', label: 'Warranty active' },
] as const

export function StageTracker({ current, compact = false }: { current: string; compact?: boolean }) {
  const at = JOB_STAGES.findIndex((s) => s.key === current)
  return (
    <ol className="flex w-full items-start" aria-label={`Stage ${at + 1} of 7: ${JOB_STAGES[at]?.label}`}>
      {JOB_STAGES.map((s, i) => {
        const done = i < at || current === 'warranty_active'
        const here = i === at && current !== 'warranty_active'
        return (
          <li key={s.key} className="flex flex-1 flex-col items-center gap-2 text-center last:flex-none">
            <div className="flex w-full items-center">
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                done ? 'bg-redux-blue text-white' : here ? 'bg-redux-lime text-redux-blue ring-4 ring-redux-lime/30' : 'border-2 border-line bg-white text-faint')}>
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              {i < JOB_STAGES.length - 1 && <span className={cn('h-0.5 flex-1', i < at ? 'bg-redux-blue' : 'bg-line')} />}
            </div>
            {!compact && (
              <span className={cn('pr-2 text-[11px] leading-tight', here ? 'font-semibold text-ink' : 'hidden text-muted-ink sm:inline')}>
                {s.label}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── Timeline: vertical line + circled icons; actor and time on every entry (§5) ─
export type TimelineItem = { id: string; icon: LucideIcon; title: React.ReactNode; body?: React.ReactNode; actor?: string | null; at: string }
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-line">
      {items.map((it) => (
        <li key={it.id} className="relative flex gap-3">
          <IconCircle icon={it.icon} size="sm" className="relative z-10 ring-4 ring-white" />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-sm font-medium text-ink">{it.title}</p>
            {it.body && <div className="mt-0.5 text-sm text-muted-ink">{it.body}</div>}
            <p className="mt-1 text-xs text-faint">
              {it.actor ? `${it.actor} · ` : ''}
              <time dateTime={it.at}>{formatWhen(it.at)}</time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

// ── Before / after: side by side, labelled — never a slider (§5, UX 3) ────────
export function BeforeAfter({ before, after, caption }: { before: string | null; after: string | null; caption?: string }) {
  const pane = (src: string | null, label: 'BEFORE' | 'AFTER') => (
    <figure className="relative overflow-hidden rounded-md border border-line bg-surface">
      {src ? (
        // demo photos are local SVG/JPG assets; production uses short-lived signed URLs (BR-X3)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${label.toLowerCase()} — ${caption ?? 'fitting'}`} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center text-xs text-faint">Photo to come</div>
      )}
      <figcaption className={cn('eyebrow absolute top-2 left-2 rounded-sm px-2 py-0.5',
        label === 'BEFORE' ? 'bg-ink text-white' : 'bg-redux-lime text-redux-blue')}>
        {label}
      </figcaption>
    </figure>
  )
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">{pane(before, 'BEFORE')}{pane(after, 'AFTER')}</div>
      {caption && <p className="mt-2 text-sm text-muted-ink">{caption}</p>}
    </div>
  )
}

// ── Dates in IST, one format everywhere ───────────────────────────────────────
export function formatWhen(iso: string | Date, withTime = true): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(d)
}

export function formatRelative(iso: string | Date): string {
  const ms = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(ms)
  const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' })
  if (abs < 3_600_000) return rtf.format(Math.round(ms / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(ms / 3_600_000), 'hour')
  return rtf.format(Math.round(ms / 86_400_000), 'day')
}
