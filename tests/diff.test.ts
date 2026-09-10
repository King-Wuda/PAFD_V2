import { describe, expect, it } from 'vitest'
import { diffPriceList, summariseDiff, type PricedCode } from '@/lib/import/diff'
import type { StandardRow } from '@/lib/import/types'

function row(code: string, price: number | null, description = 'thing'): StandardRow {
  return { code, description, unit: 'each', price }
}

function held(code: string, price: number | null): PricedCode {
  return { code, description: 'thing', price, effectiveFrom: '2026-04-15' }
}

describe('the import diff', () => {
  const existing = [held('KEEP', 100), held('CHANGED', 100), held('GONE', 55)]
  const incoming = [row('KEEP', 100), row('CHANGED', 110), row('BRANDNEW', 20)]
  const diff = diffPriceList(incoming, existing)

  it('reports a changed price with its delta', () => {
    const change = diff.changes.find((c) => c.code === 'CHANGED')
    expect(change).toMatchObject({ oldPrice: 100, newPrice: 110, kind: 'price' })
    expect(change?.deltaPct).toBeCloseTo(0.1)
  })

  it('reports a new code', () => {
    expect(diff.newCodes.map((r) => r.code)).toEqual(['BRANDNEW'])
  })

  it('reports a code missing from the new list, keeping its old price', () => {
    expect(diff.missingCodes).toHaveLength(1)
    expect(diff.missingCodes[0]).toMatchObject({ code: 'GONE', keptPrice: 55 })
  })

  it('counts matches and unchanged rows', () => {
    expect(diff.matched).toBe(2)
    expect(diff.unchanged).toBe(1)
  })

  it('summarises for the confirmation dialogue', () => {
    expect(summariseDiff(diff)).toBe('2 prices matched · 1 changed · 1 new · 1 not on this list')
  })
})

describe('suspicious moves', () => {
  it('flags anything past +/-20% as a likely unit or column error', () => {
    const diff = diffPriceList(
      [row('A', 130), row('B', 110), row('C', 64.49)],
      [held('A', 100), held('B', 100), held('C', 6449)],
    )
    expect(diff.suspicious.map((c) => c.code).sort()).toEqual(['A', 'C'])
  })

  it('sorts changes by largest move first', () => {
    const diff = diffPriceList(
      [row('SMALL', 105), row('BIG', 300)],
      [held('SMALL', 100), held('BIG', 100)],
    )
    expect(diff.changes[0].code).toBe('BIG')
  })

  it('treats a move onto or off P.O.A. as a change without a percentage', () => {
    const diff = diffPriceList(
      [row('A', null), row('B', 90)],
      [held('A', 100), held('B', null)],
    )
    const kinds = Object.fromEntries(diff.changes.map((c) => [c.code, c.kind]))
    expect(kinds).toEqual({ A: 'poa-added', B: 'poa-removed' })
    expect(diff.changes.every((c) => c.deltaPct === null)).toBe(true)
  })

  it('carries parse errors through to the review screen', () => {
    const diff = diffPriceList([row('A', 1)], [], [{ line: 4, raw: 'junk', reason: 'nope' }])
    expect(diff.errors).toHaveLength(1)
  })
})
