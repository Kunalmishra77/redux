# 04 — SEO Plan · D1

The website has two jobs: convert the traffic REDUX pays for, and earn traffic it doesn't.
Paid conversion comes first — organic is a 6–12 month compounding asset, not a Phase 1 KPI.

---

## 1. The search reality

REDUX sits in an unusual position: the service is **restoration**, but almost everyone searching
is searching for **replacement**. The strategy is therefore to rank for replacement-adjacent
queries and reframe the reader.

| Intent | Example queries | Our angle |
|---|---|---|
| **Problem-aware** (best) | "chrome tap peeling", "shower mixer stiff to turn", "bathroom tap leaking from base" | The fitting may be restorable |
| **Part-hunting** (highest intent) | "[brand] cartridge discontinued", "spare parts for old [brand] mixer" | **Eurobrass can re-machine it.** Nobody else can say this |
| **Replacement-intent** | "replace hotel bathroom fittings", "bathroom fitting replacement cost" | Compare restoration vs replacement honestly |
| **Finish** | "PVD coating bathroom fittings India", "re-chrome bathroom taps Delhi" | Direct service match |
| **B2B** | "hotel bathroom refurbishment vendor Delhi", "hotel maintenance bathroom fittings" | The hotels page |

**The part-hunting cluster is the most valuable and least contested.** A chief engineer searching
for a discontinued cartridge at 11pm has a problem nobody else can solve. That is where REDUX's
manufacturing moat becomes a search moat.

---

## 2. Page targeting

| Page | Primary | Secondary |
|---|---|---|
| `/` | bath fittings restoration India | tap restoration, bathroom fitting repair |
| `/hotels` | hotel bathroom fittings restoration | hotel bathroom refurbishment Delhi |
| `/services/restore-finish` | PVD coating bathroom fittings | re-chrome taps, chrome restoration |
| `/services/restore-function` | bathroom tap repair | mixer cartridge replacement |
| `/services/water-efficiency` | water saving aerator taps | low flow bathroom fittings |
| `/why-redux` | Eurobrass bath fittings | discontinued tap spare parts India |
| `/work` | bathroom fitting restoration before after | — |
| `/work/[slug]` | long-tail per property type | — |

---

## 3. Technical SEO

| Item | Implementation |
|---|---|
| Rendering | Static with `cacheComponents: true` — the marketing site is the only cached part of the platform |
| Core Web Vitals | LCP <2.0 s, CLS <0.1, INP <200 ms |
| Images | `next/image`, WebP/AVIF, explicit dimensions, hero with `priority`. Note Next 16 changed the defaults (`qualities: [75]`, 4 h `minimumCacheTTL`) |
| Sitemap | `app/sitemap.ts`, auto-generated, includes case studies |
| Robots | `app/robots.ts`. **`app.` and `my.` subdomains fully disallowed** |
| Canonicals | Self-referencing on every page |
| Metadata | Next `generateMetadata`; unique title and description per page |
| Structured data | `LocalBusiness` + `Service` on `/`; `BreadcrumbList`; `ImageObject` on case studies |
| hreflang | `en-IN` |
| 404 | Custom, with links to services and the enquiry form |

### Structured data
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "REDUX — Bath Restorations by Eurobrass",
  "description": "Restoration of bathroom fittings — function, finish and water efficiency — backed by 50 years of Eurobrass manufacturing.",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "D 8/7, Okhla Phase 1",
    "addressLocality": "New Delhi",
    "postalCode": "110020",
    "addressCountry": "IN"
  },
  "areaServed": ["Delhi NCR", "India"],
  "url": "https://reduxbath.com"
}
```

---

## 4. Content plan (post-launch, ~2 per month)

Each piece answers a real question a chief engineer or homeowner types. No keyword-stuffed filler —
a hotel engineer can smell it, and it damages the credibility the deck works so hard to build.

**Months 1–3 — the part-hunting cluster (highest intent)**
1. Your tap model is discontinued. What are the actual options?
2. What can and cannot be restored on a bathroom mixer
3. Restoration vs replacement: a cost comparison for a 50-room hotel
4. Why chrome peels, and what PVD does differently
5. How long a bathroom is actually out of service during restoration
6. What a free fitting assessment covers

**Months 4–6 — process and proof**
7. Planning bathroom work around occupancy
8. Reading a restoration quotation: what each line means
9. Warranty on restored fittings: what's covered
10. Water-saving retrofits that don't change the fitting
11. Case study: `[ first cleared hotel engagement ]`
12. Brand-standard audits and bathroom hardware

---

## 5. Local SEO

- **Google Business Profile** — primary category *Bathroom remodeler* or *Plumbing supply store*
  (test both; the categories behave differently in Maps). Service areas: Delhi, Gurugram, Noida,
  Ghaziabad, Faridabad.
- Real photos of restored fittings, not stock imagery.
- NAP consistent everywhere, matching the footer exactly.
- Reviews: ask 30 days after handover — which is already `feedback_request` (CN17). **Never
  incentivise a review**; it is an unfair trade practice under the Consumer Protection Act.

---

## 6. Measurement

| Metric | Target by month 6 | Where |
|---|---|---|
| Organic sessions | 800/month | GA4 |
| Organic leads | 15/month | CRM, `source = website` |
| Rank, part-hunting cluster | Top 5 for 5 terms | Search Console |
| CWV | All green | Search Console |
| Website → survey conversion | ≥25% | CRM |

**The number that matters is CRM leads, not sessions.** The CRM already tags source, campaign and
UTM on every lead, so organic ROI is measurable from day one without a separate analytics project.

---

## 7. What we are not doing

| Not doing | Why |
|---|---|
| Buying backlinks | Risk with no upside for a brand this specific |
| Programmatic city landing pages | Thin content; REDUX serves NCR, not 200 cities |
| Blog for volume | One good part-hunting article beats twenty thin ones in a niche this narrow |
| Targeting "plumber near me" | Wrong buyer entirely |
