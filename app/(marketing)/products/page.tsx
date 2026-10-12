import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Wrench } from 'lucide-react'
import { CtaBand, PageHero, Section } from '@/components/marketing/sections'
import { getCatalog } from '@/lib/data/catalog'
import { pageMetadata } from '@/lib/constants/site'

export const metadata: Metadata = pageMetadata({
  title: 'What we restore — taps, mixers, showers and valves',
  description: 'The bathroom fittings REDUX restores for hotels and businesses: mixers, showers, diverters, spouts, health faucets and valves — restored, repaired or replaced with Eurobrass.',
  path: '/products',
})

// CR-001 phase 7 (D30) — the catalog on the website, from the database (published products only).
export default async function ProductsPage({ searchParams }: PageProps<'/products'>) {
  const { category } = await searchParams
  const { categories, products } = await getCatalog()
  const active = typeof category === 'string' && categories.some((c) => c.slug === category) ? category : null
  const list = active ? products.filter((p) => p.category?.slug === active) : products
  return (
    <>
      <PageHero breadcrumbs={[{ name: 'What we restore', href: '/products' }]} eyebrow="Catalog" title="What we restore."
        intro="Every fitting below is assessed from four photo angles and priced three ways — restore, repair, or replace with Eurobrass — so you choose with the numbers in front of you." />
      <Section labelledBy="catalog">
        <h2 id="catalog" className="sr-only">Products</h2>
        {categories.length > 1 && (
          <nav aria-label="Categories" className="mb-8 flex flex-wrap gap-2">
            <Link href="/products" aria-current={!active ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-medium ${!active ? 'bg-redux-blue text-white' : 'bg-surface text-ink hover:bg-pale'}`}>All</Link>
            {categories.map((c) => <Link key={c.slug} href={`/products?category=${c.slug}`} aria-current={active === c.slug ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-medium ${active === c.slug ? 'bg-redux-blue text-white' : 'bg-surface text-ink hover:bg-pale'}`}>{c.name}</Link>)}
          </nav>
        )}
        {list.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => {
              const img = p.media.find((m) => m.kind === 'after') ?? p.media.find((m) => m.kind === 'image') ?? p.media[0]
              return (
                <li key={p.id}>
                  <Link href={`/products/${p.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition hover:border-redux-blue/40">
                    <div className="aspect-[4/3] bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img ? <img src={img.url} alt={img.alt} className="size-full object-cover" loading="lazy" />
                        : <div className="flex size-full flex-col items-center justify-center gap-2 text-faint"><Wrench className="size-10" aria-hidden /><span className="text-xs">Picture coming soon</span></div>}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      {p.category && <p className="eyebrow text-redux-blue">{p.category.name}</p>}
                      <h3 className="mt-1 text-lg font-semibold text-ink">{p.name}</h3>
                      {p.description && <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-muted-ink">{p.description}</p>}
                      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-redux-blue">Details <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : <p className="text-muted-ink">The catalog is being prepared. Ask us about any tap, mixer or shower — we assess them all.</p>}
      </Section>
      <CtaBand title="Not sure what you have?" body="Photograph it in a free self-assessment, or ask us to visit. You get the three prices for every fitting before you decide." />
    </>
  )
}
