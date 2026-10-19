// Public website (D1) — contact details, navigation and page names in one place so the footer,
// contact page, schema.org and WhatsApp button can never disagree (SEO plan §5: NAP consistency).
//
// Values marked CLIENT INPUT are demo stand-ins until REDUX supplies them
// (blueprint/00-brief/04-assumptions-open-questions.md). Change them here only.

export const SITE = {
  url: 'https://reduxbath.com',
  name: 'REDUX — Bath Restorations by Eurobrass',
  shortName: 'REDUX',
  description:
    'Restoration of bathroom fittings — function, finish and water efficiency — backed by 50 years of Eurobrass manufacturing.',
  address: {
    line1: 'Eurobrass Headquarters, D 8/7, Okhla Phase 1',
    locality: 'New Delhi',
    postalCode: '110020',
    country: 'India',
  },
  // TEMPORARY (REDUX, 19 Oct 2026): REDUX will have its own number and mailbox (A2). Until then every
  // contact point uses the Eurobrass head office line and email (eurobrass.in and the 2025 catalogue) —
  // including WhatsApp, so no button on the site points at a number that does not exist.
  phoneDisplay: '+91 11 4161 2972',
  phoneE164: '+911141612972',
  whatsappNumber: '911141612972',
  email: 'info@eurobrass.in',
  privacyEmail: 'info@eurobrass.in',
  // Consumer Protection (E-Commerce) Rules 2020 — CLIENT INPUT: the named officer (temporary: the office)
  grievance: {
    name: 'Grievance Officer, REDUX',
    email: 'info@eurobrass.in',
    phoneDisplay: '+91 11 4161 2972',
  },
  hours: 'Monday to Saturday, 10:00 to 18:30 IST',
  serviceAreas: ['Delhi', 'Gurugram', 'Noida', 'Ghaziabad', 'Faridabad'],
} as const

export const PRIMARY_CTA = 'Request an assessment'
export const SECONDARY_CTA = 'Dealer enquiry'

export type NavItem = { href: string; label: string; description?: string; b2c?: boolean }

/** BR-B3: B2C items show only while settings.b2c_enabled is on. */
export const visibleNav = (items: NavItem[], b2c: boolean) => items.filter((i) => b2c || !i.b2c)

export const SERVICE_NAV: NavItem[] = [
  { href: '/services/restore-function', label: 'Restore function', description: 'Leaks, worn internal parts, stiff controls' },
  { href: '/services/restore-finish', label: 'Restore the finish', description: 'Chrome and coloured PVD finishes' },
  { href: '/services/water-efficiency', label: 'Improve efficiency', description: 'Compatible water-saving components' },
]

export const MAIN_NAV: NavItem[] = [
  { href: '/hotels', label: 'For hotels' },
  { href: '/homes', label: 'For homes', b2c: true },
  { href: '/products', label: 'Products' },
  { href: '/work', label: 'Our work' },
  { href: '/process', label: 'Process' },
  { href: '/why-redux', label: 'Why REDUX' },
]

export const FOOTER_NAV: { title: string; items: NavItem[] }[] = [
  { title: 'Services', items: SERVICE_NAV },
  {
    title: 'Who we work with',
    items: [
      { href: '/hotels', label: 'Hotels' },
      { href: '/homes', label: 'Homes', b2c: true },
      { href: '/dealers', label: 'Dealers' },
      { href: '/register', label: 'Create a business account' },
      { href: '/portal/login', label: 'Customer sign in' },
    ],
  },
  {
    title: 'REDUX',
    items: [
      { href: '/why-redux', label: 'Why REDUX' },
      { href: '/process', label: 'Assessment & pilot' },
      { href: '/how-we-restore', label: 'The REDUX Way' },
      { href: '/assessment', label: 'How the assessment works' },
      { href: '/demo-programme', label: 'Free demo programme' },
      { href: '/referral-programme', label: 'Referral programme' },
      { href: '/products', label: 'Products' },
      { href: '/work', label: 'Before & after' },
      { href: '/contact', label: 'Contact' },
    ],
  },
]

export const LEGAL_NAV: NavItem[] = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refunds', label: 'Refund & Cancellation' },
  { href: '/contact', label: 'Contact' },
]

// E2-S11: the WhatsApp message names the page it came from, so the CRM knows which page converted
const PAGE_NAMES: [prefix: string, name: string][] = [
  ['/services/restore-function', 'Restore function'],
  ['/services/restore-finish', 'Restore the finish'],
  ['/services/water-efficiency', 'Improve efficiency'],
  ['/hotels', 'For hotels'],
  ['/homes', 'For homes'],
  ['/dealers', 'For dealers'],
  ['/dealer-enquiry', 'Dealer enquiry'],
  ['/why-redux', 'Why REDUX'],
  ['/work', 'Before & after'],
  ['/process', 'Assessment & pilot process'],
  ['/how-we-restore', 'The REDUX Way'],
  ['/assessment', 'How the assessment works'],
  ['/demo-programme', 'Free demo programme'],
  ['/referral-programme', 'Referral programme'],
  ['/products', 'Products'],
  ['/contact', 'Contact'],
  ['/book-assessment', 'Request an assessment'],
  ['/thank-you', 'Thank you'],
]

export function pageNameFor(pathname: string): string {
  if (pathname === '/') return 'Home'
  return PAGE_NAMES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1] ?? 'Website'
}

export function whatsappHref(pathname: string): string {
  const text = `Hello REDUX, I'm on your website (${pageNameFor(pathname)} page) and would like to ask about a free assessment.`
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(text)}`
}

// SEO plan §3: unique title + description per page, self-referencing canonical, hreflang en-IN
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }) {
  return {
    title,
    description,
    alternates: { canonical: path, languages: { 'en-IN': path } },
    openGraph: { title, description, url: path },
  }
}
