'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImagePlus, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { importProductsAction, setProductPublishedAction, uploadProductImageAction, type ImportResult } from '@/lib/actions/catalog'
import { parseCsv } from '@/lib/services/csv'
import { shrinkImage } from '@/lib/shrink-image'

// CR-001 phase 7 (D30) — catalog import, pictures and publishing

const TEMPLATE = 'sku,name,category,fitting_type,description,applications,benefits,restore_info,finishes,published,image\r\n' +
  'EB-BM-101,Single-lever basin mixer,mixers,basin_mixer,"Deck-mounted, ceramic cartridge",Hotel guest bathrooms,Costs a fraction of new|No retiling,"Cartridge rebuilt, chrome re-plated",chrome|pvd_brushed_gold,yes,\r\n'

export function CatalogImport() {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pending, start] = useTransition()
  const run = (file: File | undefined) => {
    if (!file) return
    start(async () => {
      const rows = parseCsv(await file.text())
      const r = await importProductsAction(rows)
      if (input.current) input.current.value = ''
      if (!r.ok) { toast.error(r.message); return }
      setResult(r.data)
      toast.success(`${r.data.created} added, ${r.data.updated} updated${r.data.errors.length ? `, ${r.data.errors.length} with problems` : ''}`)
      router.refresh()
    })
  }
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-ink">Save the catalog as CSV (Excel: <em>Save as → CSV UTF-8</em>). One row per product; a row with an existing SKU updates it. Separate several benefits or finishes with <span className="num">|</span>.</p>
      <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="redux-catalog-template.csv" className="text-sm font-medium text-redux-blue hover:underline">Download the template</a>
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" id="cat-file" onChange={(e) => run(e.target.files?.[0])} />
      <div><Button asChild size="sm" disabled={pending}><label htmlFor="cat-file" className="cursor-pointer">{pending ? <Loader2 className="animate-spin" /> : <Upload aria-hidden />} Import CSV</label></Button></div>
      {result && (
        <div className="rounded-md bg-surface p-3">
          <p className="font-medium text-ink"><span className="num">{result.created}</span> added · <span className="num">{result.updated}</span> updated</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-danger">{result.errors.slice(0, 20).map((e) => <li key={e.row}>Row {e.row}{e.sku ? ` (${e.sku})` : ''}: {e.error}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  )
}

export function PublishToggle({ id, published }: { id: string; published: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button size="xs" variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await setProductPublishedAction(id, !published)
      if (r.ok) { toast.success(published ? 'Taken off the website' : 'Published'); router.refresh() } else toast.error(r.message)
    })}>{published ? 'Unpublish' : 'Publish'}</Button>
  )
}

export function ImageUpload({ productId }: { productId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const id = `img-${productId}`
  return (
    <>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        start(async () => {
          const { blob } = await shrinkImage(file).catch(() => ({ blob: file as Blob }))
          const fd = new FormData()
          fd.set('productId', productId); fd.set('kind', 'image'); fd.set('file', new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' }))
          const r = await uploadProductImageAction(fd)
          if (r.ok) { toast.success('Image added'); router.refresh() } else toast.error(r.message)
        })
      }} />
      <Button asChild size="xs" variant="ghost" disabled={pending}><label htmlFor={id} className="cursor-pointer" aria-label="Add image">{pending ? <Loader2 className="animate-spin" /> : <ImagePlus aria-hidden />}</label></Button>
    </>
  )
}
