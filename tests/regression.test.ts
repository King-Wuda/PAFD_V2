import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseStandardCsv } from '@/lib/import/csv'
import { CATALOGUE, allRows, rowCount } from '@/lib/catalogue'
import { PriceBook } from '@/lib/prices/resolve'
import type { CurrentPrice } from '@/lib/prices/types'

/**
 * The regression the old tool was signed off against (§15):
 *
 *   1,204 selectable rows · 655 fittings priced exactly to catalogue rate
 *   5 P.O.A. correctly unpriced · 0 wrong · 0 rows lost
 *
 * It runs against the seed CSV and the ported catalogue constants. Both come
 * out of Piping_15.html — see docs/PORTING.md. Until that port lands, this
 * file reports what is missing rather than passing vacuously.
 *
 * Two figures below read 654/6 rather than 655/5, and the difference is one
 * row: PVCFTY10125, a 125 mm 45° tee carrying "price": 0.0 in the old price
 * list and "non-stock, on request" in its own note. The old table printed
 * "R 0.00" for it and counted it among the 655. Here it is P.O.A., because
 * quoting a non-stock fitting at zero is how a job goes out under-priced.
 * That is the only row on which this port deliberately disagrees with §15;
 * every other number is the signed-off one, unchanged.
 */

const SEED_DIR = join(__dirname, '..', 'seed')
// Named, not "the first CSV": seed/ also holds the Macsteel list, and which
// one readdir returns first is not something to hang the regression on.
const seedFile = existsSync(SEED_DIR)
  ? readdirSync(SEED_DIR).find((f) => f.startsWith('pvc-') && f.endsWith('.csv'))
  : undefined

const catalogueRowCount = rowCount()
const ported = seedFile !== undefined && catalogueRowCount > 0

if (!ported) {
  console.warn(
    '\n  regression: SKIPPED — port not done.' +
      `\n    seed CSV in seed/: ${seedFile ?? 'none'}` +
      `\n    catalogue rows:    ${catalogueRowCount}` +
      '\n    See docs/PORTING.md.\n',
  )
}

describe('regression against the original tool', () => {
  // Named so the reason shows up in the test output rather than as silence.
  it.skipIf(ported)('is waiting on the port from Piping_15.html', () => {
    expect(seedFile, 'no seed CSV in seed/ — see docs/PORTING.md').toBeUndefined()
  })

  // The assertions below read the seed file, so they are only constructed once
  // the port has landed. Nothing here passes vacuously.
  if (!ported) return

  const csv = parseStandardCsv(readFileSync(join(SEED_DIR, seedFile!), 'utf8'))

  const priceBook = new PriceBook(
    csv.rows.map<CurrentPrice>((row) => ({
      supplier: 'Seed',
      code: row.code,
      description: row.description,
      unit: row.unit,
      price: row.price,
      effectiveFrom: csv.effectiveFrom ?? '2026-04-15',
      priceListId: 'seed',
      onCurrentList: true,
      supplierCurrentFrom: csv.effectiveFrom ?? '2026-04-15',
    })),
  )

  it('loads the seed list without parse errors', () => {
    expect(csv.errors).toEqual([])
    // One line per coded catalogue row: 655 from DEFAULT_PRICE_LIST plus the
    // five P.O.A. fittings the old list never carried. The 277 description-only
    // Macsteel lines are not here — `prices.code` is not null, so there is no
    // key to file them under, and they priced nothing in the old tool either.
    // They are kept verbatim in seed/reference/. See docs/PORTING.md.
    expect(csv.rows).toHaveLength(660)
  })

  it('carries 1,204 selectable catalogue rows', () => {
    expect(catalogueRowCount).toBe(1204)
  })

  it('prices every coded fitting and loses no row', () => {
    const resolved = allRows().map(({ row }) => priceBook.resolve(row))
    expect(resolved).toHaveLength(1204)

    const priced = resolved.filter((r) => r.state === 'priced' || r.state === 'stale')
    expect(priced).toHaveLength(654)   // 655 in §15, less PVCFTY10125 — see above
  })

  it('leaves the P.O.A. items unpriced', () => {
    const poa = allRows()
      .map(({ row }) => priceBook.resolve(row))
      .filter((r) => r.state === 'poa')

    expect(poa).toHaveLength(6)   // the five marked P.O.A., plus PVCFTY10125
  })

  it('prices every coded row by code, never by guess', () => {
    const guessed = allRows()
      .filter(({ row }) => row.code)
      .map(({ row }) => priceBook.resolve(row))
      .filter((r) => r.matchedBy === 'fuzzy')

    expect(guessed).toEqual([])
  })

  it('gives every table at least one sheet with rows', () => {
    for (const table of CATALOGUE) {
      const rows = table.sheets.reduce((n, sheet) => n + sheet.rows.length, 0)
      expect(rows, `${table.id} has no rows`).toBeGreaterThan(0)
    }
  })

  it.each([
    ['PVCFGO10063', 64.49],
    ['PVCFTR100630050', 96.37],
  ])('prices %s at R%s', (code, expected) => {
    expect(priceBook.lookupByCode(code)?.price).toBe(expected)
  })

  it('prices sockets 16-63mm to the published rates', () => {
    const expected: Record<number, number> = {
      16: 15.03, 20: 10.66, 25: 10.91, 32: 12.9,
      40: 18.77, 50: 22.9, 63: 35.52,
    }

    for (const [size, rate] of Object.entries(expected)) {
      const match = csv.rows.find(
        (row) =>
          /socket/i.test(row.description) &&
          new RegExp(`\\b${size}\\s*mm\\b`, 'i').test(row.description),
      )
      expect(match, `no socket row for ${size}mm`).toBeDefined()
      expect(match!.price, `socket ${size}mm`).toBe(rate)
    }
  })
})
