import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { SITE } from '@/lib/constants/site'

// SEO plan §3: the app. (staff) and my. (customer portal) subdomains are fully disallowed; the
// marketing site is open except for private paths and the post-conversion page.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') ?? ''
  const sub = host.split('.')[0]
  if (host.endsWith('reduxbath.com') && (sub === 'app' || sub === 'my')) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/staff', '/portal', '/demo', '/api', '/thank-you'],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
