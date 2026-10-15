import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CtaBand, PageHero, Section } from '@/components/marketing/sections'
import { EnquiryLink } from '@/components/marketing/enquiry-dialog'
import { getProduct } from '@/lib/data/catalog'
import { pageMetadata } from '@/lib/constants/site'

export async function generateMetadata({ params }: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const p = await getProduct(slug)
  return pageMetadata({ title: p ? `${p.name} — restoration` : 'Product', description: p?.description ?? 'Bathroom fitting restoration by REDUX.', path: `/products/${slug}` })
}

// CR-001 phase 7 (D30) — one product: what it is, how REDUX restores it, finishes, "assess this product"
export default async function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params
  const p = await getProduct(slug)
  if (!p) notFound()
  const before = p.media.find((m) => m.kind === 'before')
  const after = p.media.find((m) => m.kind === 'after')
  const images = p.media.filter((m) => m.kind === 'image')
  return (
    <>
      <PageHero breadcrumbs={[{ name: 'Products', href: '/products' }, { name: p.name, href: `/products/${p.slug}` }]}
        eyebrow={p.category?.name ?? 'Catalog'} title={p.name} intro={p.description ?? undefined}
        actions={
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="text-base"><EnquiryLink>Assess this fitting</EnquiryLink></Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-base text-white hover:bg-white/10"><Link href="/register">Create a business account</Link></Button>
          </div>
        } />
      <Section labelledBy="detail">
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-4">
            {(before || after) && (
              <div className="grid grid-cols-2 gap-3">
                {[before, after].map((m, i) => m && (
                  <figure key={i} className="relative overflow-hidden rounded-xl border border-line bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.alt} className="aspect-[4/3] w-full object-cover" />
                    <figcaption className={`absolute top-2 left-2 rounded-sm px-2 py-0.5 text-[10px] font-bold tracking-wider ${i ? 'bg-redux-lime text-redux-blue' : 'bg-ink text-white'}`}>{i ? 'AFTER' : 'BEFORE'}</figcaption>
                  </figure>
                ))}
              </div>
            )}
            {images.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.url} src={m.url} alt={m.alt} className="w-full rounded-xl border border-line bg-white object-contain p-6" loading="lazy" />
            ))}
            {p.media.length === 0 && (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface text-faint"><Wrench className="size-12" aria-hidden /><span className="text-sm">Picture coming soon</span></div>
            )}
          </div>
          <div className="space-y-8">
            <h2 id="detail" className="sr-only">Details</h2>
            {p.restore_info && <div><h3 className="text-lg font-semibold text-ink">How we restore it</h3><p className="mt-2 text-[15px] leading-relaxed text-muted-ink">{p.restore_info}</p></div>}
            {p.benefits.length > 0 && (
              <ul className="space-y-2">{p.benefits.map((b) => <li key={b} className="flex gap-2 text-[15px] text-ink"><Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />{b}</li>)}</ul>
            )}
            {p.applications && <div><h3 className="text-lg font-semibold text-ink">Where it is used</h3><p className="mt-2 text-[15px] leading-relaxed text-muted-ink">{p.applications}</p></div>}
            {p.finishes.length > 0 && (
              <div><h3 className="text-lg font-semibold text-ink">Finishes</h3>
                <div className="mt-2 flex flex-wrap gap-2">{p.finishes.map((f) => <span key={f} className="rounded-full bg-surface px-3 py-1 text-sm text-ink">{f}</span>)}</div></div>
            )}
            {Object.keys(p.specs).length > 0 && (
              <div><h3 className="text-lg font-semibold text-ink">Specifications</h3>
                <dl className="mt-2 divide-y divide-line rounded-xl border border-line">{Object.entries(p.specs).map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2 text-sm"><dt className="text-muted-ink">{k}</dt><dd className="text-right text-ink">{String(v)}</dd></div>)}</dl></div>
            )}
          </div>
        </div>
      </Section>
      <CtaBand title="Have this fitting in your rooms?" body="A free assessment prices it three ways — restore, repair, or replace with Eurobrass — before you decide anything." />
    </>
  )
}
