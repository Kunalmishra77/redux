import { calculateYouSave } from '@/lib/services/pricing'

// Offline three-price assessment (D7, surveyor app). A pure mirror of the server's
// rate_card_price() / market_price() / upsert_assessment() so the surveyor can show all three
// prices on site with no signal. The server re-prices on sync (api-spec: "server re-prices");
// this function must agree with it, which is why it lives here and is shared with the web.
// Pure: no Next, no React Native, no I/O (ADR-014).

export const TREATMENTS = ['restore_finish', 'repair_function', 'replace_eurobrass', 'no_action'] as const
export type Treatment = (typeof TREATMENTS)[number]

export type RateCardItem = {
  fittingTypeId: string
  workTypeCode: string
  finishId: string | null // null = finish irrelevant
  price: string // numeric as a decimal string — never a float (CLAUDE.md rule 5)
}

export type MarketPrice = {
  fittingTypeId: string
  finishId: string | null
  price: string
}

/**
 * BR-A3: price lookup on ONE rate-card version. The exact finish wins; otherwise the
 * finish-irrelevant (null) row. Mirrors public.rate_card_price().
 */
export function rateCardPrice(
  items: readonly RateCardItem[],
  fittingTypeId: string,
  workTypeCode: string,
  finishId: string | null,
): string | null {
  let fallback: string | null = null
  for (const i of items) {
    if (i.fittingTypeId !== fittingTypeId || i.workTypeCode !== workTypeCode) continue
    if (finishId !== null && i.finishId === finishId) return i.price
    if (i.finishId === null) fallback = i.price
  }
  return fallback
}

/** BR-A4: market replacement price — exact finish first, then finish-less. Mirrors public.market_price(). */
export function marketPrice(
  prices: readonly MarketPrice[],
  fittingTypeId: string,
  finishId: string | null,
): string | null {
  let fallback: string | null = null
  for (const m of prices) {
    if (m.fittingTypeId !== fittingTypeId) continue
    if (finishId !== null && m.finishId === finishId) return m.price
    if (m.finishId === null) fallback = m.price
  }
  return fallback
}

export type AssessmentPrices = {
  recommended: string | null
  replaceEurobrass: string | null
  marketReplacement: string | null
  /** BR-A4: null when there is no positive saving — the UI hides it */
  youSave: string | null
  /** BR-A2: the options with no rate-card price. Non-empty → the server will refuse it without an override (BR-A5) */
  missing: Array<'recommended work' | 'Eurobrass replacement' | 'market replacement'>
}

/**
 * BR-A2: all three options are always priced — recommended work, Eurobrass replacement, market
 * replacement. BR-A3: from the active rate card. The target finish (when restoring to a new
 * finish) wins over the current finish, exactly as upsert_assessment() does. 'no_action' costs 0.
 */
export function priceAssessment(input: {
  items: readonly RateCardItem[]
  market: readonly MarketPrice[]
  fittingTypeId: string
  recommended: Treatment
  currentFinishId: string | null
  targetFinishId?: string | null
}): AssessmentPrices {
  const finish = input.targetFinishId ?? input.currentFinishId ?? null
  const recommended =
    input.recommended === 'no_action'
      ? '0'
      : rateCardPrice(input.items, input.fittingTypeId, input.recommended, finish)
  const replaceEurobrass = rateCardPrice(input.items, input.fittingTypeId, 'replace_eurobrass', finish)
  const marketReplacement = marketPrice(input.market, input.fittingTypeId, finish)

  const missing: AssessmentPrices['missing'] = []
  if (recommended === null) missing.push('recommended work')
  if (replaceEurobrass === null) missing.push('Eurobrass replacement')
  if (marketReplacement === null) missing.push('market replacement')

  const youSave =
    recommended !== null && marketReplacement !== null
      ? calculateYouSave(marketReplacement, recommended)
      : null

  return { recommended, replaceEurobrass, marketReplacement, youSave, missing }
}
