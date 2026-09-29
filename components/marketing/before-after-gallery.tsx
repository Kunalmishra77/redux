'use client'

import * as React from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from 'cn'
import { BeforeAfter, EmptyState } from '@/components/patterns'
import { FINISHES, FITTING_GROUPS, type FinishKey, type FittingGroup, type GalleryItem } from '@/lib/content/gallery'

// A1 §5 / A9 — side by side, labelled, never a slider (design system §5). Filterable by fitting type
// and, on the full gallery, by finish.

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { key: T | 'all'; label: string }[]
  value: T | 'all'
  onChange: (v: T | 'all') => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={cn(
              'h-10 rounded-full px-4 text-sm font-medium transition-colors',
              on ? 'bg-redux-blue text-white' : 'bg-white text-redux-blue ring-1 ring-line ring-inset hover:bg-select',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function BeforeAfterGallery({
  items,
  withFinishFilter = false,
  className,
}: {
  items: GalleryItem[]
  withFinishFilter?: boolean
  className?: string
}) {
  const [group, setGroup] = React.useState<FittingGroup | 'all'>('all')
  const [finish, setFinish] = React.useState<FinishKey | 'all'>('all')

  const shown = items.filter((i) => (group === 'all' || i.group === group) && (finish === 'all' || i.finish === finish))

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Chips
          label="Filter by fitting type"
          options={[{ key: 'all', label: 'All' }, ...FITTING_GROUPS.map((g) => ({ key: g.key, label: g.label }))]}
          value={group}
          onChange={setGroup}
        />
        {withFinishFilter && (
          <Chips
            label="Filter by finish"
            options={[{ key: 'all', label: 'All finishes' }, ...FINISHES.map((f) => ({ key: f.key, label: f.label }))]}
            value={finish}
            onChange={setFinish}
          />
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {shown.length} before-and-after {shown.length === 1 ? 'pair' : 'pairs'}
      </p>

      {shown.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={ImageOff}
            title="Before-and-after photography is being added."
            body="Ask us for examples for your property type."
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((i) => (
            <li key={i.id} className="rounded-xl border border-line bg-white p-3 shadow-card">
              <BeforeAfter before={i.before} after={i.after} caption={i.caption} />
              <div className="mt-2 flex flex-wrap gap-1.5 px-1 pb-1">
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-medium text-redux-blue">{i.typeLabel}</span>
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-medium text-muted-ink">{i.finishLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
