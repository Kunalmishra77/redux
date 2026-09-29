// A9 — Before & after showcase.
//
// BR-P3: a customer's site photographs never reach this page. The gallery is REDUX's own showcase
// set (client input A6 — demo illustrations until REDUX's photography arrives), not survey evidence.
// Publishing consented site photos (v_marketing_photos) is a later step and must go through that view.

export const FITTING_GROUPS = [
  { key: 'basin', label: 'Basin mixers' },
  { key: 'shower', label: 'Showers' },
  { key: 'diverter', label: 'Diverters' },
  { key: 'accessory', label: 'Accessories' },
] as const
export type FittingGroup = (typeof FITTING_GROUPS)[number]['key']

export const FINISHES = [
  { key: 'chrome', label: 'Chrome' },
  { key: 'pvd_brushed_gold', label: 'PVD brushed gold' },
  { key: 'pvd_matte_black', label: 'PVD matte black' },
] as const
export type FinishKey = (typeof FINISHES)[number]['key']

const TYPES = [
  { code: 'basin_mixer', label: 'Basin mixer', group: 'basin', fix: 'cartridge replaced, body refinished' },
  { code: 'shower_mixer', label: 'Shower mixer', group: 'shower', fix: 'seals and cartridge renewed, finish restored' },
  { code: 'shower_head', label: 'Shower head', group: 'shower', fix: 'descaled, nozzles cleared, finish restored' },
  { code: 'diverter', label: 'Diverter', group: 'diverter', fix: 'spindle re-machined, finish restored' },
  { code: 'health_faucet', label: 'Health faucet', group: 'accessory', fix: 'trigger mechanism repaired, finish restored' },
  { code: 'spout', label: 'Bath spout', group: 'accessory', fix: 'aerator added, finish restored' },
] as const satisfies readonly { code: string; label: string; group: FittingGroup; fix: string }[]

export type GalleryItem = {
  id: string
  type: string
  typeLabel: string
  group: FittingGroup
  finish: FinishKey
  finishLabel: string
  before: string
  after: string
  caption: string
}

export const GALLERY: GalleryItem[] = TYPES.flatMap((t) =>
  FINISHES.map((f) => ({
    id: `${t.code}-${f.key}`,
    type: t.code,
    typeLabel: t.label,
    group: t.group,
    finish: f.key,
    finishLabel: f.label,
    before: `/demo/fittings/${t.code}-${f.key}-before.svg`,
    after: `/demo/fittings/${t.code}-${f.key}-after.svg`,
    caption: `${t.label} — ${t.fix}, restored in ${f.label.toLowerCase().replace('pvd', 'PVD')}.`,
  })),
)

/** The home page selection: one of each fitting type, varied finishes. */
export const FEATURED_GALLERY: GalleryItem[] = [
  'basin_mixer-chrome',
  'shower_mixer-pvd_matte_black',
  'diverter-chrome',
  'health_faucet-pvd_brushed_gold',
  'shower_head-chrome',
  'spout-pvd_matte_black',
].map((id) => GALLERY.find((g) => g.id === id)!)
