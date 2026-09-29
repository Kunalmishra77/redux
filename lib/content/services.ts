// A2–A4 — service pages. The section intros are the home-page copy (01-website-copy.md §3), used
// verbatim; the detail below is written in the same voice and awaits REDUX's review.

export type ServiceSlug = 'restore-function' | 'restore-finish' | 'water-efficiency'

export type Service = {
  slug: ServiceSlug
  number: string
  name: string
  metaTitle: string
  metaDescription: string
  headline: string
  intro: string
  points: { title: string; body: string }[]
  checks: string[]
  note: string
  galleryIds: string[]
}

export const SERVICES: Record<ServiceSlug, Service> = {
  'restore-function': {
    slug: 'restore-function',
    number: '01',
    name: 'Restore function',
    metaTitle: 'Bathroom tap repair and mixer cartridge replacement',
    metaDescription:
      'REDUX addresses leaks, worn internal parts and stiff controls in existing bathroom fittings — with parts Eurobrass can re-machine when the original is discontinued.',
    headline: 'Fittings that work the way they should — again.',
    intro: 'Address leaks, worn internal parts and problems with how the fitting operates.',
    points: [
      {
        title: 'Leaks and drips',
        body: 'Worn seals, washers and cartridges are the usual cause of a tap that drips or a mixer that leaks at the base. We identify the worn part and renew it.',
      },
      {
        title: 'Stiff or inconsistent controls',
        body: 'Handles that are hard to turn, diverters that stick and mixers that will not hold a temperature are assessed at the mechanism, not just the handle.',
      },
      {
        title: 'Discontinued parts',
        body: 'When a spare is no longer available, Eurobrass can re-machine the part at its own facility to match the fitting’s requirements.',
      },
    ],
    checks: [
      'Component suitability, dimensions and operation checked for each assessed fitting',
      'Pressure and leak test after refitting',
      'Operation tested through the full range before handover',
    ],
    note: 'Available repairs depend on the condition of each fitting. Where a fitting is not suitable, the assessment says so.',
    galleryIds: ['shower_mixer-chrome', 'diverter-chrome', 'health_faucet-chrome'],
  },
  'restore-finish': {
    slug: 'restore-finish',
    number: '02',
    name: 'Restore the finish',
    metaTitle: 'PVD coating and chrome restoration for bathroom fittings',
    metaDescription:
      'Restore the finish of suitable bathroom fittings in chrome or coloured PVD — brushed gold, matte black and more — at the Eurobrass facility in New Delhi.',
    headline: 'Chrome or coloured PVD — on the fittings you already have.',
    intro: 'Recoat suitable fittings in chrome or coloured PVD finishes to renew their appearance.',
    points: [
      {
        title: 'Chrome',
        body: 'Scaling, pitting and worn plating are taken back and the finish restored in chrome, so repaired fittings meet the property’s appearance standard.',
      },
      {
        title: 'Coloured PVD',
        body: 'Physical vapour deposition finishes — brushed gold, matte black and others — give suitable fittings a new look without replacing them.',
      },
      {
        title: 'Done at the factory',
        body: 'Finish restoration happens at the Eurobrass facility, not on site. Fittings are removed, restored and refitted on scheduled dates.',
      },
    ],
    checks: [
      'Base material and condition assessed before a finish is recommended',
      'Finish inspected before the fitting leaves the factory',
      'Finish inspected again after refitting, before the room returns to service',
    ],
    note: 'Not every fitting is suitable for recoating. Suitability is confirmed fitting by fitting in the assessment.',
    galleryIds: ['basin_mixer-pvd_brushed_gold', 'shower_mixer-pvd_matte_black', 'spout-chrome'],
  },
  'water-efficiency': {
    slug: 'water-efficiency',
    number: '03',
    name: 'Improve efficiency',
    metaTitle: 'Water-saving aerators and low-flow retrofits for bathroom taps',
    metaDescription:
      'Add compatible water-saving components to existing taps and showers during restoration — without changing the fitting.',
    headline: 'Use less water, without changing the fitting.',
    intro: 'Add compatible water-saving components to taps and showers.',
    points: [
      {
        title: 'Aerators and flow regulators',
        body: 'Compatible aerators and flow regulators reduce the water a tap or shower uses while keeping a comfortable flow.',
      },
      {
        title: 'Fitted during restoration',
        body: 'Efficiency components are added while the fitting is already out for restoration, so there is no separate visit and no extra downtime.',
      },
      {
        title: 'Matched to the fitting',
        body: 'Components are chosen for compatibility with each fitting’s thread, body and pressure — not a one-size-fits-all insert.',
      },
    ],
    checks: [
      'Compatibility confirmed for each fitting in the assessment',
      'Flow checked after refitting',
    ],
    note: 'Water-saving components are added only where they are compatible with the fitting.',
    galleryIds: ['spout-pvd_matte_black', 'shower_head-chrome', 'basin_mixer-chrome'],
  },
}

export const SERVICE_SLUGS = Object.keys(SERVICES) as ServiceSlug[]
