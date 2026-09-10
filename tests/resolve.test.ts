import { describe, expect, it } from 'vitest'
import { PriceBook, formatPrice, stalenessWarning, totalSchedule } from '@/lib/prices/resolve'
import type { CurrentPrice } from '@/lib/prices/types'
import type { CatalogueRow } from '@/lib/catalogue/types'

function entry(over: Partial<CurrentPrice> & { code: string }): CurrentPrice {
  return {
    supplier: 'Thermoplastics Co',
    description: 'thing',
    unit: 'each',
    price: 10,
    effectiveFrom: '2026-04-15',
    priceListId: 'list-1',
    onCurrentList: true,
    supplierCurrentFrom: '2026-04-15',
    ...over,
  }
}

function row(over: Partial<CatalogueRow> & { id: string }): CatalogueRow {
  return { title: 'thing', fixed: {}, values: { x: {} }, ...over }
}

function line(row: CatalogueRow, quantity: number, book: PriceBook) {
  const rowPrice = book.resolve(row)
  return { key: row.id, description: row.title, code: row.code ?? null, quantity, rowPrice }
}

describe('code-exact resolution', () => {
  const book = new PriceBook([
    entry({ code: 'PVCFGO10063', description: '90 deg elbow 63mm SW', price: 64.49 }),
    entry({ code: 'PVCCON1110', description: 'VDL tank connector 110mm', price: null }),
    entry({
      code: 'PVCFOLD1',
      description: 'Discontinued item',
      price: 50,
      onCurrentList: false,
      effectiveFrom: '2025-01-10',
    }),
  ])

  it('prices a coded row by its code', () => {
    const result = book.resolve(row({ id: 'r1', code: 'PVCFGO10063', title: 'elbow' }))
    expect(result.state).toBe('priced')
    expect(result.price).toBe(64.49)
    expect(result.matchedBy).toBe('code')
  })

  it('is case- and whitespace-insensitive on the code', () => {
    expect(book.resolve(row({ id: 'r1', code: ' pvcfgo10063 ' })).price).toBe(64.49)
  })

  it('shows nothing rather than guessing when a code misses', () => {
    const result = book.resolve(row({ id: 'r2', code: 'NOSUCHCODE', title: '90 deg elbow' }))
    expect(result.state).toBe('unpriced')
    expect(formatPrice(result)).toBe('')
  })

  it('renders a null price as P.O.A., never R0.00', () => {
    const result = book.resolve(row({ id: 'r3', code: 'PVCCON1110' }))
    expect(result.state).toBe('poa')
    expect(formatPrice(result)).toBe('P.O.A.')
  })

  it('keeps a code that has fallen off the current list, and flags it', () => {
    const result = book.resolve(row({ id: 'r4', code: 'PVCFOLD1' }))
    expect(result.state).toBe('stale')
    expect(result.price).toBe(50)
    expect(result.note).toContain('not on current list')
    expect(result.note).toContain('10 Jan 2025')
  })
})

describe('price schedule totals', () => {
  const book = new PriceBook([
    entry({ code: 'A', price: 100 }),
    entry({ code: 'B', price: null }),
  ])

  it('excludes P.O.A. lines from the total and reports them', () => {
    const lines = [
      line(row({ id: '1', code: 'A' }), 3, book),
      line(row({ id: '2', code: 'B' }), 5, book),
    ]
    const total = totalSchedule(lines)
    expect(total.total).toBe(300)
    expect(total.poaLines).toHaveLength(1)
    expect(total.pricedCount).toBe(1)
  })

  it('excludes unmatched lines from the total', () => {
    const missing = row({ id: '3', code: 'NOPE' })
    const total = totalSchedule([line(missing, 9, book)])
    expect(total.total).toBe(0)
    expect(total.unpricedLines).toHaveLength(1)
  })
})

describe('freshness', () => {
  it('says nothing about a recent list', () => {
    expect(stalenessWarning('2026-04-15', new Date('2026-09-09'))).toBeNull()
  })

  it('warns once a list is over twelve months old', () => {
    expect(stalenessWarning('2026-04-15', new Date('2027-06-01')))
      .toBe('Prices from 15 Apr 2026 — may be out of date.')
  })
})
