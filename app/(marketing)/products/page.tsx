import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Wrench } from 'lucide-react'
import { CtaBand, PageHero, Section } from '@/components/marketing/sections'
import { getCatalog } from '@/lib/data/catalog'
import { pageMetadata } from '@/lib/constants/site'

export const metadata: Metadata = pageMetadata({
  title: 'Eurobrass products — basin mixers, wall mixers, showers, valves and accessories',
  description: 'The Eurobrass range behind REDUX: basin and sink mixers, wall and shower mixers, diverters, spouts, valves, showers, sensor taps and accessories — restore what you have, or replace with Eurobrass.',
  path: '/products',
})

const PREVIEW = 8   // products per category on the "All" view

// CR-001 phase 7 (D30) — the catalog on the website, from the database (published products only).
export default async function ProductsPage({ searchParams }: PageProps<'/products'>) {
  const { category } = await searchParams
  const { categories, products } = await getCatalog()
  const active = typeof category === 'string' && categories.some((c) => c.slug === category) ? category : null
  const list = active ? products.filter((p) => p.category?.slug === active) : products
  return (
    <>
      <PageHero breadcrumbs={[{ name: 'Products', href: '/products' }]} eyebrow="The Eurobrass range"
        title="Restore what you have — or replace it with Eurobrass."
        intro={`${products.length} products from the Eurobrass catalogue. In a REDUX assessment, every fitting you have is priced three ways — restore, repair, or replace with Eurobrass — so you choose with the numbers in front of you.`} />
      <Section labelledBy="catalog">
        <h2 id="catalog" className="sr-only">Products</h2>
        {categories.length > 1 && (
          <nav aria-label="Categories" className="mb-8 flex flex-wrap gap-2">
            <Link href="/products" aria-current={!active ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-medium ${!active ? 'bg-redux-blue text-white' : 'bg-surface text-ink hover:bg-pale'}`}>All</Link>
            {categories.map((c) => <Link key={c.slug} href={`/products?category=${c.slug}`} aria-current={active === c.slug ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-medium ${active === c.slug ? 'bg-redux-blue text-white' : 'bg-surface text-ink hover:bg-pale'}`}>{c.name}</Link>)}
          </nav>
        )}
        {!active && categories.length > 1 ? (
          <div className="space-y-14">
            {categories.map((c) => {
              const inCat = products.filter((p) => p.category?.slug === c.slug)
              return (
                <section key={c.slug} aria-labelledby={`cat-${c.slug}`}>
                  <div className="mb-5 flex items-baseline justify-between gap-4">
                    <h2 id={`cat-${c.slug}`} className="text-2xl font-semibold text-ink">{c.name} <span className="num text-base font-normal text-muted-ink">{inCat.length}</span></h2>
                    {inCat.length > PREVIEW && <Link href={`/products?category=${c.slug}`} className="shrink-0 text-sm font-semibold text-redux-blue hover:underline">See all {inCat.length} →</Link>}
                  </div>
                  <Grid list={inCat.slice(0, PREVIEW)} />
                </section>
              )
            })}
          </div>
        ) : list.length ? <Grid list={list} /> : <p className="text-muted-ink">The catalog is being prepared. Ask us about any tap, mixer or shower — we assess them all.</p>}
      </Section>
      <CtaBand title="Not sure what you have?" body="Photograph it in a free self-assessment, or ask us to visit. You get the three prices for every fitting before you decide." />
    </>
  )
}

function Grid({ list }: { list: Awaited<ReturnType<typeof getCatalog>>['products'] }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((p) => {
        const img = p.media.find((m) => m.kind === 'after') ?? p.media.find((m) => m.kind === 'image') ?? p.media[0]
        return (
          <li key={p.id}>
            <Link href={`/products/${p.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition hover:border-redux-blue/40">
              <div className="aspect-[4/3] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img ? <img src={img.url} alt={img.alt} className="size-full object-contain p-3" loading="lazy" />
                  : <div className="flex size-full flex-col items-center justify-center gap-2 text-faint"><Wrench className="size-10" aria-hidden /><span className="text-xs">Picture coming soon</span></div>}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="eyebrow text-redux-blue">{p.specs.Series ? `${p.specs.Series} series` : p.category?.name}</p>
                <h3 className="mt-1 text-[15px] leading-snug font-semibold text-ink">{p.name}</h3>
                {p.specs.Code && <p className="num mt-1 text-xs text-muted-ink">{p.specs.Code}</p>}
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-redux-blue">Details <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
