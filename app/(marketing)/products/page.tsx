import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Search, Wrench } from 'lucide-react'
import { CtaBand, PageHero, Section, SectionHeading } from '@/components/marketing/sections'
import { getCatalog, mediaUrl, type CatalogProduct } from '@/lib/data/catalog'
import { SERIES, seriesBySlug, type Series } from '@/lib/content/series'
import { pageMetadata } from '@/lib/constants/site'

export const metadata: Metadata = pageMetadata({
  title: 'Eurobrass products — basin mixers, wall mixers, showers, valves and accessories',
  description: 'The Eurobrass range behind REDUX: basin and sink mixers, wall and shower mixers, diverters, spouts, valves, showers, sensor taps and accessories — restore what you have, or replace with Eurobrass.',
  path: '/products',
})

const PER_PAGE = 24
const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim() : '')
type Category = { slug: string; name: string }

/** The best picture of a product: a studio photo first, then the catalogue thumbnail. */
const pictureOf = (p: CatalogProduct | undefined) => p && (p.media.find((m) => m.url.includes('/eb/')) ?? p.media.find((m) => m.kind === 'image' || m.kind === 'after') ?? p.media[0])

// CR-001 phase 7 (D30) — the catalogue in steps instead of 469 cards at once: choose a type or a series
// (or search), then browse 24 at a time. Every view is a plain link, so it can be shared.
export default async function ProductsPage({ searchParams }: PageProps<'/products'>) {
  const sp = await searchParams
  const { categories, products } = await getCatalog()
  const category = categories.find((c) => c.slug === str(sp.category)) ?? null
  const series = seriesBySlug(str(sp.series))
  const q = str(sp.q).slice(0, 60)
  const browsing = !category && !series && !q

  return (
    <>
      <PageHero breadcrumbs={[{ name: 'Products', href: '/products' }]} eyebrow="The Eurobrass range"
        title="Restore what you have — or replace it with Eurobrass."
        intro={`${products.length} products from the Eurobrass catalogue. In a REDUX assessment, every fitting you have is priced three ways — restore, repair, or replace with Eurobrass — so you choose with the numbers in front of you.`}>
        <SearchBox q={q} />
      </PageHero>
      {products.length === 0
        ? <Section><p className="text-muted-ink">The catalogue is being prepared. Ask us about any tap, mixer or shower — we assess them all.</p></Section>
        : browsing ? <Browse categories={categories} products={products} />
          : <Results products={products} categories={categories} category={category} series={series} q={q} page={Number(str(sp.page)) || 1} />}
      <CtaBand title="Not sure what you have?" body="Photograph it in a free self-assessment, or ask us to visit. You get the three prices for every fitting before you decide." />
    </>
  )
}

function SearchBox({ q }: { q: string }) {
  return (
    <form action="/products" role="search" className="mt-8 flex max-w-xl overflow-hidden rounded-xl bg-white shadow-card">
      <label htmlFor="pq" className="sr-only">Search products by name or code</label>
      <input id="pq" name="q" type="search" defaultValue={q} placeholder="Search by name or code — e.g. basin mixer, PU 102" className="h-12 min-w-0 flex-1 px-4 text-[15px] text-ink outline-none placeholder:text-faint" />
      <button type="submit" className="flex h-12 shrink-0 items-center gap-2 bg-redux-lime px-5 text-sm font-semibold text-redux-blue"><Search className="size-4" aria-hidden />Search</button>
    </form>
  )
}

function Browse({ categories, products }: { categories: Category[]; products: CatalogProduct[] }) {
  const inSeries = (s: Series) => products.filter((p) => p.specs.Series?.toLowerCase() === s.name.toLowerCase()).length
  return (
    <>
      <Section labelledBy="types">
        <SectionHeading id="types" eyebrow="Browse by type" title="What are you looking for?" />
        <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => {
            const list = products.filter((p) => p.category?.slug === c.slug)
            if (!list.length) return null
            const hero = list.map(pictureOf).find((m) => m?.url.includes('/eb/')) ?? pictureOf(list[0])
            return (
              <li key={c.slug}>
                <Link href={`/products?category=${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition hover:border-redux-blue/40">
                  <div className="aspect-square bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {hero ? <img src={hero.url} alt="" className="size-full object-contain p-4 transition group-hover:scale-[1.03]" loading="lazy" /> : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
                    <span className="text-[15px] font-semibold text-ink">{c.name}</span>
                    <span className="num rounded-full bg-surface px-2 py-0.5 text-xs text-muted-ink">{list.length}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </Section>
      <Section tone="surface" labelledBy="series">
        <SectionHeading id="series" eyebrow="Browse by series" title="One look, across the whole bathroom." intro="Each Eurobrass series carries one design across basin, shower, spout and valve — so everything in a room matches." />
        <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {SERIES.filter((s) => inSeries(s) > 0).map((s) => (
            <li key={s.slug}>
              <Link href={`/products?series=${s.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-ink">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(s.cover)} alt="" className="size-full object-cover opacity-90 transition duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="text-lg font-semibold">{s.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-pale">{s.blurb}</p>
                  <p className="num mt-2 text-xs font-semibold text-redux-lime">{inSeries(s)} products →</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}

function Results({ products, categories, category, series, q, page }: {
  products: CatalogProduct[]; categories: Category[]; category: Category | null; series: Series | null; q: string; page: number
}) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const compactQ = q.toLowerCase().replace(/[\s-]/g, '')
  const matchesQ = (p: CatalogProduct) => {
    const code = (p.specs.Code ?? '').toLowerCase()
    if (compactQ && code.replace(/[\s-]/g, '').includes(compactQ)) return true
    const hay = `${p.name} ${code} ${p.specs.Series ?? ''} ${p.category?.name ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  }
  const base = products.filter((p) => (!series || p.specs.Series?.toLowerCase() === series.name.toLowerCase()) && (!q || matchesQ(p)))
  const list = category ? base.filter((p) => p.category?.slug === category.slug) : base
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const current = Math.min(Math.max(1, page), pages)
  const shown = list.slice((current - 1) * PER_PAGE, current * PER_PAGE)
  const href = (o: { category?: string | null; series?: string | null; page?: number }) => {
    const u = new URLSearchParams()
    const c = o.category === undefined ? category?.slug : o.category
    const s = o.series === undefined ? series?.slug : o.series
    if (c) u.set('category', c)
    if (s) u.set('series', s)
    if (q) u.set('q', q)
    if (o.page && o.page > 1) u.set('page', String(o.page))
    const qs = u.toString()
    return `/products${qs ? `?${qs}` : ''}`
  }
  const title = [series && `${series.name} series`, category?.name, q && `“${q}”`].filter(Boolean).join(' · ')
  const counts = new Map(categories.map((c) => [c.slug, base.filter((p) => p.category?.slug === c.slug).length]))
  return (
    <Section labelledBy="results">
      <Link href="/products" className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> All products</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="results" className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
          {series && <p className="mt-1 max-w-2xl text-[15px] text-muted-ink">{series.blurb}</p>}
        </div>
        <p className="num text-sm text-muted-ink">{list.length} {list.length === 1 ? 'product' : 'products'}</p>
      </div>
      <nav aria-label="Type" className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <Link href={href({ category: null })} aria-current={!category ? 'page' : undefined} className={chip(!category)}>All types <span className="num opacity-70">{base.length}</span></Link>
        {categories.filter((c) => (counts.get(c.slug) ?? 0) > 0 || c.slug === category?.slug).map((c) => (
          <Link key={c.slug} href={href({ category: c.slug })} aria-current={category?.slug === c.slug ? 'page' : undefined} className={chip(category?.slug === c.slug)}>{c.name} <span className="num opacity-70">{counts.get(c.slug)}</span></Link>
        ))}
      </nav>
      <nav aria-label="Series" className="mb-8 flex gap-2 overflow-x-auto pb-1">
        <Link href={href({ series: null })} aria-current={!series ? 'page' : undefined} className={chip(!series, true)}>Any series</Link>
        {SERIES.map((s) => <Link key={s.slug} href={href({ series: s.slug })} aria-current={series?.slug === s.slug ? 'page' : undefined} className={chip(series?.slug === s.slug, true)}>{s.name}</Link>)}
      </nav>
      {shown.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {shown.map((p) => <Card key={p.id} p={p} />)}
        </ul>
      ) : <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted-ink">Nothing matches. Try another word or code — or <Link href="/products" className="font-medium text-redux-blue hover:underline">browse all products</Link>.</p>}
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {current > 1 && <Link href={href({ page: current - 1 })} className="inline-flex h-10 items-center gap-1 rounded-full px-4 text-sm font-medium text-redux-blue ring-1 ring-line hover:bg-surface"><ArrowLeft className="size-4" aria-hidden />Previous</Link>}
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: n })} aria-current={n === current ? 'page' : undefined} aria-label={`Page ${n}`}
              className={`num flex size-10 items-center justify-center rounded-full text-sm font-medium ${n === current ? 'bg-redux-blue text-white' : 'text-ink ring-1 ring-line hover:bg-surface'}`}>{n}</Link>
          ))}
          {current < pages && <Link href={href({ page: current + 1 })} className="inline-flex h-10 items-center gap-1 rounded-full px-4 text-sm font-medium text-redux-blue ring-1 ring-line hover:bg-surface">Next<ArrowRight className="size-4" aria-hidden /></Link>}
        </nav>
      )}
    </Section>
  )
}

const chip = (on: boolean, small = false) =>
  `shrink-0 whitespace-nowrap rounded-full font-medium ${small ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-sm'} ${on ? 'bg-redux-blue text-white' : 'bg-surface text-ink hover:bg-pale'}`

function Card({ p }: { p: CatalogProduct }) {
  const img = pictureOf(p)
  return (
    <li>
      <Link href={`/products/${p.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition hover:border-redux-blue/40">
        <div className="aspect-square bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img src={img.url} alt={img.alt} className="size-full object-contain p-3 transition group-hover:scale-[1.03]" loading="lazy" />
            : <div className="flex size-full flex-col items-center justify-center gap-2 text-faint"><Wrench className="size-10" aria-hidden /><span className="text-xs">Picture coming soon</span></div>}
        </div>
        <div className="flex flex-1 flex-col border-t border-line p-4">
          <p className="eyebrow text-redux-blue">{p.specs.Series ? `${p.specs.Series} series` : p.category?.name}</p>
          <h3 className="mt-1 text-[14px] leading-snug font-semibold text-ink sm:text-[15px]">{p.name}</h3>
          {p.specs.Code && <p className="num mt-auto pt-2 text-xs text-muted-ink">{p.specs.Code}</p>}
        </div>
      </Link>
    </li>
  )
}
