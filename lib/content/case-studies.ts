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
  pairs: { before: string; after: string; caption: string }[]
}

const pair = (type: string, finish: string, caption: string) => ({
  before: `/demo/fittings/${type}-${finish}-before.svg`,
  after: `/demo/fittings/${type}-${finish}-after.svg`,
  caption,
})

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'business-hotel-gurugram',
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
      'Removal, factory restoration and refitting scheduled before work began, including transport and testing.',
      'Every room checked for leaks, tested for operation and inspected for finish before reopening.',
    ],
    outcome: 'The restored fittings were back in service in batches, without taking a floor offline for a month.',
    pairs: [
      pair('shower_mixer', 'chrome', 'Shower mixer — cartridge re-machined, chrome finish restored.'),
      pair('basin_mixer', 'chrome', 'Basin mixer — internal parts renewed, aerator added.'),
    ],
  },
  {
    slug: 'heritage-hotel-jaipur',
    title: 'A heritage property keeps its original fittings — in a new finish',
    summary:
      'Premium fittings the owners wanted to keep, with worn finishes and stiff controls. Restored in coloured PVD to match a room refresh.',
    propertyType: 'Heritage hotel',
    scale: '48 rooms',
    city: 'Jaipur',
    problem: [
      'Original diverters and spouts had become stiff to operate and inconsistent in flow.',
      'The finish no longer matched the property’s refreshed interiors.',
      'Replacement would have meant new fittings that did not suit the character of the rooms.',
    ],
    restored: [
      'Diverter spindles re-machined and seals renewed.',
      'Suitable fittings recoated in PVD brushed gold to match the new interiors.',
      'Fittings not suitable for restoration were identified in the assessment and quoted for replacement.',
    ],
    downtime: [
      'Work planned around the property’s low-occupancy months.',
      'Rooms returned to service only after leak, operation and finish checks.',
    ],
    outcome: 'The property retained the fittings that defined its rooms, in a finish that matched the refresh.',
    pairs: [
      pair('diverter', 'pvd_brushed_gold', 'Diverter — spindle re-machined, restored in PVD brushed gold.'),
      pair('spout', 'pvd_brushed_gold', 'Bath spout — restored in PVD brushed gold.'),
    ],
  },
  {
    slug: 'south-delhi-residence',
    title: 'Three bathrooms in a family home, restored in a single visit window',
    summary:
      'Leaking health faucets and a peeling finish. The family chose restoration over retiling around new fittings.',
    propertyType: 'Private residence',
    scale: '3 bathrooms',
    city: 'Delhi',
    problem: [
      'Health faucets leaking from the trigger, and a basin mixer stiff to turn.',
      'Chrome peeling on fittings that were otherwise sound.',
      'New fittings of a different size would have meant disturbing the tiles.',
    ],
    restored: [
      'Trigger mechanisms repaired and internal parts renewed.',
      'Finishes restored in PVD matte black, at the family’s choice.',
    ],
    downtime: [
      'Fittings removed and refitted on agreed dates, one bathroom at a time so the home stayed usable.',
      'Each fitting tested for leaks and operation at handover.',
    ],
    outcome: 'The family kept their fittings and their tiles, with a finish they chose.',
    pairs: [
      pair('health_faucet', 'pvd_matte_black', 'Health faucet — trigger repaired, restored in PVD matte black.'),
      pair('basin_mixer', 'pvd_matte_black', 'Basin mixer — cartridge renewed, restored in PVD matte black.'),
    ],
  },
]

export function caseStudyBySlug(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug)
}
