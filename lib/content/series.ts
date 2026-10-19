// CR-001 phase 7 (D30) — the Eurobrass series: introductions from the 2025 catalogue (GEORGIAN's page
// there is placeholder text, so its line is ours until REDUX supplies one) and cover photos from
// eurobrass.in, stored in the brand bucket (catalog/series/<slug>.jpg).

export type Series = { slug: string; name: string; blurb: string; cover: string }

export const SERIES: Series[] = [
  { slug: 'pure', name: 'Pure', blurb: 'Minimal yet understated modern luxury, with contemporary, well-defined straight lines.' },
  { slug: 'georgian', name: 'Georgian', blurb: 'Traditional detailing with a timeless, classic profile.' },
  { slug: 'studio', name: 'Studio', blurb: 'Serene and soothing — visual interest without adding clutter.' },
  { slug: 'ivy', name: 'Ivy', blurb: 'An innovative, modern design for the dynamic, urban lifestyle.' },
  { slug: 'sigma', name: 'Sigma', blurb: 'Classic-contemporary luxury with a chic, feather-touch look.' },
  { slug: 'ronda', name: 'Ronda', blurb: 'Soft, rounded forms across a wide range for every room.' },
  { slug: 'time', name: 'Time', blurb: 'A marriage between classic and modern, with well-defined mixed lines.' },
  { slug: 'aztech', name: 'Aztech', blurb: 'West meets East, balancing both aspects beautifully.' },
  { slug: 'mode', name: 'Mode', blurb: 'A third dimension of modern luxury — more than meets the eye.' },
  { slug: 'dune', name: 'Dune', blurb: 'Fine lines and well-defined curves that create their own space.' },
  { slug: 'smart', name: 'Smart', blurb: 'Longer spouts and levers for unmatched comfort and detail.' },
  { slug: 'neo', name: 'Neo', blurb: 'The modern classic era, with the right moulded curves.' },
  { slug: 'alpha', name: 'Alpha', blurb: 'Solid construction with a fine, delicate finish, built for durability.' },
  { slug: 'classic', name: 'Classic', blurb: 'A modern take on classic design, with a forward stance.' },
  { slug: 'lite', name: 'Lite', blurb: 'Unmatched functionality that pairs with any modern faucet.' },
].map((s) => ({ ...s, cover: `catalog/series/${s.slug}.jpg` }))

export const seriesBySlug = (slug: string | undefined) => SERIES.find((s) => s.slug === slug) ?? null
export const seriesByName = (name: string | undefined) => SERIES.find((s) => s.name.toLowerCase() === (name ?? '').toLowerCase()) ?? null
