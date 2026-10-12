import type { MetadataRoute } from 'next'
import { CASE_STUDIES } from '@/lib/content/case-studies'
import { SERVICE_SLUGS } from '@/lib/content/services'
import { SITE } from '@/lib/constants/site'
import { getB2CEnabled } from '@/lib/data/website'
import { getCatalog } from '@/lib/data/catalog'

// SEO plan §3: auto-generated, includes case studies. Conversion and legal pages are listed but low priority.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [b2c, { products }] = await Promise.all([getB2CEnabled(), getCatalog()])
  const page = (path: string, priority: number, changeFrequency: 'weekly' | 'monthly' | 'yearly' = 'monthly') => ({
    url: `${SITE.url}${path}`,
    changeFrequency,
    priority,
    alternates: { languages: { 'en-IN': `${SITE.url}${path}` } },
  })
  return [
    page('', 1, 'weekly'),
    page('/hotels', 0.9),
    ...SERVICE_SLUGS.map((s) => page(`/services/${s}`, 0.8)),
    ...(b2c ? [page('/homes', 0.8)] : []),
    page('/dealers', 0.6),
    page('/why-redux', 0.7),
    page('/work', 0.7, 'weekly'),
    ...CASE_STUDIES.map((c) => page(`/work/${c.slug}`, 0.6)),
    page('/process', 0.7),
    page('/assessment', 0.7),
    page('/demo-programme', 0.6),
    page('/referral-programme', 0.5),
    page('/products', 0.7, 'weekly'),
    ...products.map((p) => page(`/products/${p.slug}`, 0.5)),
    page('/book-assessment', 0.8),
    page('/register', 0.6),
    page('/dealer-enquiry', 0.5),
    page('/contact', 0.6),
    page('/privacy', 0.2, 'yearly'),
    page('/terms', 0.2, 'yearly'),
    page('/refunds', 0.2, 'yearly'),
  ]
}
