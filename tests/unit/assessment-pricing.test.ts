import { describe, expect, it } from 'vitest'
import {
  marketPrice,
  priceAssessment,
  rateCardPrice,
  type MarketPrice,
  type RateCardItem,
} from '@/lib/services/assessment-pricing'

const MIXER = 'ft-mixer'
const CHROME = 'fin-chrome'
const GOLD = 'fin-gold'

const items: RateCardItem[] = [
  { fittingTypeId: MIXER, workTypeCode: 'restore_finish', finishId: CHROME, price: '2200' },
  { fittingTypeId: MIXER, workTypeCode: 'restore_finish', finishId: GOLD, price: '3520' },
  { fittingTypeId: MIXER, workTypeCode: 'repair_function', finishId: null, price: '1400' },
  { fittingTypeId: MIXER, workTypeCode: 'replace_eurobrass', finishId: null, price: '12500.50' },
]
const market: MarketPrice[] = [
  { fittingTypeId: MIXER, finishId: null, price: '23520' },
  { fittingTypeId: MIXER, finishId: GOLD, price: '41000' },
]

describe('BR-A3: rate-card lookup mirrors rate_card_price()', () => {
  it('prefers the exact finish, then falls back to the finish-irrelevant row', () => {
    expect(rateCardPrice(items, MIXER, 'restore_finish', GOLD)).toBe('3520')
    expect(rateCardPrice(items, MIXER, 'repair_function', GOLD)).toBe('1400')
    expect(rateCardPrice(items, MIXER, 'restore_finish', 'fin-unknown')).toBeNull()
    expect(rateCardPrice(items, 'ft-other', 'repair_function', null)).toBeNull()
  })

  it('market price: exact finish first, then finish-less', () => {
    expect(marketPrice(market, MIXER, GOLD)).toBe('41000')
    expect(marketPrice(market, MIXER, CHROME)).toBe('23520')
    expect(marketPrice(market, MIXER, null)).toBe('23520')
  })
})

describe('BR-A2: all three options are always priced', () => {
  it('prices recommended, Eurobrass replacement and market replacement', () => {
    const p = priceAssessment({ items, market, fittingTypeId: MIXER, recommended: 'restore_finish', currentFinishId: CHROME })
    expect(p).toEqual({
      recommended: '2200',
      replaceEurobrass: '12500.50',
      marketReplacement: '23520',
      youSave: '21320.00',
      missing: [],
    })
  })

  it('the target finish wins over the current finish (restoring chrome to gold)', () => {
    const p = priceAssessment({
      items, market, fittingTypeId: MIXER, recommended: 'restore_finish', currentFinishId: CHROME, targetFinishId: GOLD,
    })
    expect(p.recommended).toBe('3520')
    expect(p.marketReplacement).toBe('41000')
  })

  it("'no_action' costs nothing but the other two are still priced", () => {
    const p = priceAssessment({ items, market, fittingTypeId: MIXER, recommended: 'no_action', currentFinishId: CHROME })
    expect(p.recommended).toBe('0')
    expect(p.replaceEurobrass).toBe('12500.50')
    expect(p.missing).toEqual([])
  })

  it('names every missing price (BR-A5: the server will need an override)', () => {
    const p = priceAssessment({ items: [], market: [], fittingTypeId: MIXER, recommended: 'repair_function', currentFinishId: null })
    expect(p.missing).toEqual(['recommended work', 'Eurobrass replacement', 'market replacement'])
    expect(p.youSave).toBeNull()
  })
})

describe('BR-A4: You save is hidden when not positive', () => {
  it('is null when recommended ≥ market', () => {
    const p = priceAssessment({
      items, market: [{ fittingTypeId: MIXER, finishId: null, price: '1000' }],
      fittingTypeId: MIXER, recommended: 'repair_function', currentFinishId: null,
    })
    expect(p.youSave).toBeNull()
  })
})
