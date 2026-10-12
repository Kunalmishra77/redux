import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { PageHeader, Panel, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { mediaUrl } from '@/lib/data/catalog'
import { CatalogImport, ImageUpload, PublishToggle } from './catalog-controls'

export const metadata: Metadata = { title: 'Catalog' }

type Row = { id: string; sku: string; slug: string; name: string; is_published: boolean; category: { name: string } | null; ft: { name: string } | null
  media: { path: string; kind: string }[] }

// E24 (D30) — the product catalog: import REDUX's catalog from a spreadsheet, add pictures, publish.
export default async function CatalogAdminPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const [{ data }, { data: cats }, { data: types }] = await Promise.all([
    supabase.from('products').select('id, sku, slug, name, is_published, category:product_categories(name), ft:fitting_types(name), media:product_media(path, kind)').order('sort_order').order('name'),
    supabase.from('product_categories').select('slug, name').order('sort_order'),
    supabase.from('fitting_types').select('code, name').eq('is_active', true).order('sort_order'),
  ])
  const rows = (data ?? []) as unknown as Row[]
  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Catalog"
        description="What the website shows under “What we restore”, what the customer picks in a self-assessment, and what quote lines and stock link to."
        actions={<Link href="/products" target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline">View on the website <ExternalLink className="size-3.5" aria-hidden /></Link>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title={`Products (${rows.length})`}>
          <table className="w-full min-w-[40rem] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted-ink">{['', 'Product', 'Category', 'Fitting type', 'Status', ''].map((h, i) => <th key={i} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((p) => {
                const img = p.media.find((m) => m.kind === 'after') ?? p.media[0]
                return (
                  <tr key={p.id} className="border-b border-line align-middle last:border-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <td className="px-2 py-2">{img ? <img src={mediaUrl(img.path)} alt="" className="size-12 rounded-md border border-line object-cover" /> : <span className="block size-12 rounded-md bg-surface" />}</td>
                    <td className="px-2 py-2"><Link href={`/products/${p.slug}`} target="_blank" className="font-medium text-ink hover:underline">{p.name}</Link><span className="num block text-xs text-muted-ink">{p.sku} · {p.media.length} image{p.media.length === 1 ? '' : 's'}</span></td>
                    <td className="px-2 py-2 text-muted-ink">{p.category?.name ?? '—'}</td>
                    <td className="px-2 py-2 text-muted-ink">{p.ft?.name ?? '—'}</td>
                    <td className="px-2 py-2"><StatusPill tone={p.is_published ? 'positive' : 'neutral'}>{p.is_published ? 'Published' : 'Draft'}</StatusPill></td>
                    <td className="px-2 py-2"><span className="flex justify-end gap-1"><ImageUpload productId={p.id} /><PublishToggle id={p.id} published={p.is_published} /></span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.some((p) => p.sku.startsWith('GEN-')) && <p className="mt-3 text-xs text-muted-ink">The <span className="num">GEN-</span> entries are generic placeholders, one per fitting type. Import REDUX’s catalog and unpublish them.</p>}
        </Panel>
        <div className="min-w-0 space-y-5">
          <Panel title="Import from a spreadsheet"><CatalogImport /></Panel>
          <Panel title="Codes the file can use">
            <p className="text-xs font-semibold text-muted-ink">category</p>
            <p className="num mb-3 text-xs text-ink">{(cats ?? []).map((c) => c.slug).join(' · ')}</p>
            <p className="text-xs font-semibold text-muted-ink">fitting_type</p>
            <p className="num text-xs text-ink">{(types ?? []).map((t) => t.code).join(' · ')}</p>
          </Panel>
        </div>
      </div>
    </>
  )
}
