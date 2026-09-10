import { describe, expect, it } from 'vitest'
import { PRICE_FAMILIES, familyOf, fuzzyMatch } from '@/lib/prices/match'
import type { CurrentPrice } from '@/lib/prices/types'

function price(code: string, description: string, value: number | null): CurrentPrice {
  return {
    supplier: 'Test', code, description, unit: 'each', price: value,
    effectiveFrom: '2026-04-15', priceListId: 'list-1',
    onCurrentList: true, supplierCurrentFrom: '2026-04-15',
  }
}

describe('the family guard', () => {
  it('tests pipe last', () => {
    expect(PRICE_FAMILIES[PRICE_FAMILIES.length - 1]).toBe('pipe')
  })

  it('resolves "Pipe support clip" to clip, not pipe', () => {
    expect(familyOf('Pipe support clip')).toBe('clip')
  })

  it('resolves "PVC pipe cement 500ml" to cement, not pipe', () => {
    expect(familyOf('PVC pipe cement 500ml')).toBe('cement')
  })

  it('still resolves a plain pipe row to pipe', () => {
    expect(familyOf('PVC pressure pipe 110mm Class 6')).toBe('pipe')
  })
})

describe('fuzzy fallback', () => {
  it('refuses to price 237B off the 237A rate', () => {
    const candidates = [
      price('CEM237A', 'Pipe cement 237A 500ml', 210.0),
      price('CEM237B', 'Pipe cement 237B 500ml', 265.0),
    ]
    // The row itself is coded in real life; this is the no-code path.
    expect(fuzzyMatch('Pipe cement 237B 500ml', [candidates[0]])).toBeNull()
  })

  it('will not cross families', () => {
    const candidates = [price('FLG300150', 'ASA300 forged flange 150mm', 1450.0)]
    expect(fuzzyMatch('Carbon steel end cap 150mm', candidates)).toBeNull()
  })

  it('will not price 6" SS pipe off a nipple rate', () => {
    const candidates = [price('SSNIP6', 'SS nipple 6" Sch 10S', 88.0)]
    expect(fuzzyMatch('SS pipe 6" Sch 10S', candidates)).toBeNull()
  })

  it('returns null when two candidates are equally plausible', () => {
    const candidates = [
      price('A', 'Solvent cement large tin', 100),
      price('B', 'Solvent cement large tin', 120),
    ]
    expect(fuzzyMatch('Solvent cement large tin', candidates)).toBeNull()
  })

  it('matches when there is one clear candidate', () => {
    const candidates = [
      price('CEM500', 'Solvent cement 500ml', 210.0),
      price('TAPE20', 'PTFE tape 20m', 12.0),
    ]
    expect(fuzzyMatch('Solvent cement 500ml', candidates)?.code).toBe('CEM500')
  })
})
