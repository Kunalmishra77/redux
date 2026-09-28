import { cn } from 'cn'

// Typographic wordmark until REDUX's logo files arrive (client input A6).
export function Logo({ tone = 'blue', className, withTagline = false }: {
  tone?: 'blue' | 'white'
  className?: string
  withTagline?: boolean
}) {
  return (
    <span className={cn('inline-flex flex-col leading-none', className)}>
      <span className={cn('flex items-baseline gap-1 text-[22px] font-extrabold tracking-[0.14em]',
        tone === 'white' ? 'text-white' : 'text-redux-blue')}>
        REDUX
        <span className="inline-block size-2 rounded-full bg-redux-lime" aria-hidden />
      </span>
      {withTagline && (
        <span className={cn('mt-1 text-[10px] font-medium tracking-[0.18em] uppercase',
          tone === 'white' ? 'text-pale' : 'text-muted-ink')}>
          Bath Restorations by Eurobrass
        </span>
      )}
    </span>
  )
}
