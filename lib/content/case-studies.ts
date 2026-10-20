// A10 — Case studies. Structure (screen spec A9/A10): property type and scale → the problem →
// what was restored → downtime → before/after → an outcome line. No client quote without written
// permission, and no property name REDUX has not cleared for public use (client input A7).
//
// These three are ILLUSTRATIVE demo engagements, labelled as such on the page, until REDUX supplies
// cleared ones.

export type CaseStudy = {
  slug: string
  title: string
  summary: string
  propertyType: string
  scale: string
  city: string
  problem: string[]
  restored: string[]
  downtime: string[]
  outcome: string
  cover: string
  pairs: { before: string; after: string; caption: string }[]
}

// REDUX's generated images (20 Oct 2026), public/site/case-studies — illustrative, like the engagements
const cover = (slug: string) => `/site/case-studies/case-${slug}-cover.jpg`
const pair = (slug: string, n: number, caption: string) => ({
  before: `/site/case-studies/case-${slug}-before-${n}.jpg`,
  after: `/site/case-studies/case-${slug}-after-${n}.jpg`,
  caption,
})

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'business-hotel-gurugram',
    cover: cover('business-hotel-gurugram'),
    title: 'A 120-room business hotel, restored in batches between conferences',
    summary:
      'Recurring shower-mixer leaks and a scaled chrome finish, ahead of a brand-standard audit. Pilot bathroom first, then the wider project floor by floor.',
    propertyType: 'Business hotel',
    scale: '120 rooms · 6 floors',
    city: 'Gurugram',
    problem: [
      'Shower mixers on four floors were back on the maintenance list within weeks of each repair.',
      'The mixer model had been discontinued; available spares were either costly or not quite the right fit.',
      'Hard-water scaling had dulled the chrome finish ahead of the brand-standard audit.',
    ],
    restored: [
      'Free assessment of every fitting, room by room, photographed from four angles.',
      'A pilot bathroom with agreed work, cost and timing — reviewed by the engineering team before approval.',
      'Mixer cartridges re-machined at Eurobrass to match the original fitting; finish restored in chrome.',
      'Compatible aerators added to basin mixers where the fitting allowed.',
    ],
    downtime: [
      'Rooms taken out of service in batches around dates the hotel approved, avoiding conference weeks.',
      'Dismantling by the hotel team, collection, factory restoration and return scheduled before work began.',
      'Every room checked for leaks, tested for operation and inspected for finish before reopening.',
    ],
    outcome: 'The restored fittings were back in service in batches, without taking a floor offline for a month.',
    pairs: [
      pair('business-hotel-gurugram', 1, 'Basin mixer — internal parts renewed, aerator added.'),
      pair('business-hotel-gurugram', 2, 'Shower mixer — cartridge re-machined, chrome finish restored.'),
    ],
  },
  {
    slug: 'heritage-hotel-jaipur',
    cover: cover('heritage-hotel-jaipur'),
    title: 'A heritage property keeps its original fittings — in a new finish',
    summary:
      'Premium fittings the owners wanted to keep, with worn finishes and stiff controls. Restored in PVD brushed gold to match a room refresh.',
    propertyType: 'Heritage hotel',
    scale: '48 rooms',
    city: 'Jaipur',
    problem: [
      'Original basin mixers and spouts had become stiff to operate and inconsistent in flow.',
      'The finish no longer matched the property’s refreshed interiors.',
      'Replacement would have meant new fittings that did not suit the character of the rooms.',
    ],
    restored: [
      'Cartridges renewed and seals replaced.',
      'Suitable fittings recoated in PVD brushed gold to match the new interiors.',
      'Fittings not suitable for restoration were identified in the assessment and quoted for replacement.',
    ],
    downtime: [
      'Work planned around the property’s low-occupancy months.',
      'Rooms returned to service only after leak, operation and finish checks.',
    ],
    outcome: 'The property retained the fittings that defined its rooms, in a finish that matched the refresh.',
    pairs: [
      pair('heritage-hotel-jaipur', 1, 'Basin mixer — cartridge renewed, restored in PVD brushed gold.'),
      pair('heritage-hotel-jaipur', 2, 'Bath spout — restored in PVD brushed gold.'),
    ],
  },
  {
    slug: 'south-delhi-residence',
    cover: cover('south-delhi-residence'),
    title: 'Three bathrooms in a family home, restored in a single visit window',
    summary:
      'Leaking health faucets and a peeling finish. The family chose restoration over retiling around new fittings.',
    propertyType: 'Private residence',
    scale: '3 bathrooms',
    city: 'Delhi',
    problem: [
      'Health faucets leaking from the trigger, and a wall mixer stiff to turn.',
      'Chrome peeling on fittings that were otherwise sound.',
      'New fittings of a different size would have meant disturbing the tiles.',
    ],
    restored: [
      'Trigger mechanisms repaired and internal parts renewed.',
      'Finishes restored in chrome, to match the rest of the bathrooms.',
    ],
    downtime: [
      'Fittings dismantled by the owner\'s plumber and returned restored one bathroom at a time, so the home stayed usable.',
      'Each fitting tested for leaks and operation at handover.',
    ],
    outcome: 'The family kept their fittings and their tiles, with the finish looking new.',
    pairs: [
      pair('south-delhi-residence', 1, 'Wall mixer — cartridge renewed, chrome finish restored.'),
      pair('south-delhi-residence', 2, 'Health faucet — trigger repaired, chrome finish restored.'),
    ],
  },
]

export function caseStudyBySlug(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug)
}
