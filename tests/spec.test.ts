import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '@/lib/catalogue'
import { parseStandardCsv } from '@/lib/import/csv'
import { PriceBook } from '@/lib/prices/resolve'
import type { CurrentPrice } from '@/lib/prices/types'
import type { CatalogueRow } from '@/lib/catalogue/types'
import { compareCandidates, specKey, specOfPriceLine, specOfRow } from '@/lib/prices/spec'

/**
 * The structured matcher exists because word overlap cannot do this job: a
 * catalogue row does not say which schedule it is being shown in, and the
 * supplier's line does. These tests pin the pairing in both directions.
 */

const find = (tableId: string, sheetId: string, dn: string): [CatalogueRow, string, string] => {
  const table = CATALOGUE.find((t) => t.id === tableId)!
  const sheet = table.sheets.find((s) => s.id === sheetId)!
  const row = sheet.rows.find((r) => r.fixed.dn === dn)!
  return [row, tableId, sheetId]
}

describe('reading a supplier line', () => {
  it.each([
    ['PIPE SEAMLESS ASTM A106 GRADE B 200 x SCH40 6.000Mtr ASTRON APPROVED', 'pipe-ms|200|SCH40'],
    ['PIPE UNCOATED PLAIN ENDED CQ HR SANS62 100 x MED 6.000Mtr SCARFED', 'pipe-sans62|100|MED'],
    ['PIPE UNCOATED PLAIN ENDED SANS 719 GRADE B 250 x 4.5 6.100Mtr', 'pipe-sans719-b|250|4.5'],
    ['ELBOW GRADE 304 L 100 x 90 LR x SCH10', 'elbow-ss-90|100|SCH10'],
    ['ELBOW GRADE 316 L 100 x 90 LR x SCH40', 'elbow-ss-90|100|SCH40'],
    ['TEE EQUAL GRADE 304 L 100 x SCH10', 'tee-ss|100|SCH10'],
    ['REDUCER CONCENTRIC GRADE 304 L 100 x 50 x SCH10', 'reducer-ss|100x50|SCH10'],
    ['BUSH REDUCING SS316 BSP THREADED 150LB 15 x 10', 'thr-bush|15x10|'],
    ['SOCKET SS316 BSP THREADED 150LB 15', 'thr-socket|15|'],
    ['NIPPLE SS316 BSP THREADED 150LB 15 x BARREL', 'thr-nipple|15|BARREL'],
    ['UNION SS316 BSP THREADED 150LB 15 x CF', 'thr-union|15|CF'],
    ['PLUG SS316 BSP THREADED 150LB 20 x SQUARE', 'thr-plug|20|SQUARE'],
    ['TEE EQUAL SS316 BSP THREADED 150LB 20 x F', 'thr-tee|20|F'],
    ['ELBOW SS316 BSP THREADED 150LB 20 x 90 x FF', 'thr-elbow|20|FF'],
    ['FORGED FLANGE ASTM/ASME A/SA 105 ASA300 x RF x WN40 x 100', 'flange-wn40|100|'],
    ['FORGED FLANGE ASTM/ASME A/SA 105 ASA300 x RF x BLD x 150', 'flange-bld|150|'],
  ])('reads %s', (description, expected) => {
    const spec = specOfPriceLine(description)
    expect(spec, description).not.toBeNull()
    expect(specKey(spec!)).toBe(expected)
  })

  it('returns null for anything it does not recognise', () => {
    expect(specOfPriceLine('PVC 90° elbow 63 mm PVCFGO10063')).toBeNull()
    expect(specOfPriceLine('')).toBeNull()
    // Close to a template but not one: no schedule, so no price to give.
    expect(specOfPriceLine('PIPE SEAMLESS ASTM A106 GRADE B 200')).toBeNull()
  })
})

describe('reading a catalogue row', () => {
  it('keys MS pipe on its schedule, which the row itself never states', () => {
    const [row, table, sheet] = find('ms-pipe', 'ms-sheet', '200')
    expect(specKey(specOfRow(table, sheet, row, 'sch40')!)).toBe('pipe-ms|200|SCH40')
    expect(specKey(specOfRow(table, sheet, row, 'sch80')!)).toBe('pipe-ms|200|SCH80')
  })

  it('keys SANS 719 on wall, because a DN alone is three products', () => {
    const table = CATALOGUE.find((t) => t.id === 'sans719-pipe')!
    const keys = table.sheets[0].rows
      .filter((r) => r.fixed.dn === '200')
      .map((r) => specKey(specOfRow('sans719-pipe', 'sans719-sheet', r, 'x')!))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives no key to the ranges this supplier does not list', () => {
    const [row] = find('a234-fittings', 'elbow-lr-90', '50')
    expect(specOfRow('a234-fittings', 'elbow-lr-90', row, 'sch40')).toBeNull()
  })
})

describe('the two sides agree', () => {
  it('matches a Sch 40 pipe line to the Sch 40 row and not the Sch 80 one', () => {
    const line = specKey(
      specOfPriceLine('PIPE SEAMLESS ASTM A106 GRADE B 200 x SCH40 6.000Mtr SASOL APPROVED')!,
    )
    const [row, table, sheet] = find('ms-pipe', 'ms-sheet', '200')
    expect(specKey(specOfRow(table, sheet, row, 'sch40')!)).toBe(line)
    expect(specKey(specOfRow(table, sheet, row, 'sch80')!)).not.toBe(line)
  })
})

/**
 * Coverage against the real lists, so a change to a template or a family name
 * shows up as a number rather than as a quietly emptier Price column.
 *
 * These are not aspirational targets. They are what the supplier's list can
 * actually answer: the ranges left at zero are ranges Macsteel does not carry
 * in this list at all, which is a different thing from a matcher that failed.
 */
describe('coverage against the seed lists', () => {
  const load = (file: string): CurrentPrice[] => {
    const parsed = parseStandardCsv(
      readFileSync(join(__dirname, '..', 'seed', file), 'utf8'),
      '2026-04-15',
    )
    expect(parsed.errors).toEqual([])
    return parsed.rows.map((row) => ({
      supplier: file.split('-')[0],
      code: row.code,
      description: row.description,
      unit: row.unit,
      price: row.price,
      effectiveFrom: '2026-04-15',
      priceListId: file,
      onCurrentList: true,
      supplierCurrentFrom: '2026-04-15',
    }))
  }

  const macsteel = load('macsteel-2026-04-15.csv')
  const book = new PriceBook([...load('pvc-2026-04-15.csv'), ...macsteel])

  it('recognises every line the supplier sent', () => {
    const unread = macsteel.filter((p) => !specOfPriceLine(p.description ?? ''))
    expect(unread.map((p) => p.description)).toEqual([])
  })

  it('prices the ranges the supplier actually carries', () => {
    const covered: Record<string, [number, number]> = {}
    for (const table of CATALOGUE) {
      for (const sheet of table.sheets) {
        for (const variant of table.variants) {
          for (const row of sheet.rows) {
            if (!row.values[variant.id]) continue
            const at = (covered[table.id] ??= [0, 0])
            at[1]++
            const price = book.resolve(row, {
              table: table.id, sheet: sheet.id, variant: variant.id,
            })
            if (price.state !== 'unpriced') at[0]++
          }
        }
      }
    }

    expect(covered['ms-pipe'][0]).toBe(36)
    expect(covered['sans62-pipe'][0]).toBe(covered['sans62-pipe'][1])
    expect(covered['sans719-pipe'][0]).toBe(covered['sans719-pipe'][1])
    expect(covered['ss-threaded'][0]).toBe(covered['ss-threaded'][1])
    expect(covered['asa300-flanges'][0]).toBe(covered['asa300-flanges'][1])
    expect(covered['pvc-fittings'][0]).toBe(660)

    // Not in this supplier's list at all — blank is the honest answer, and a
    // number appearing here means something started guessing.
    expect(covered['a234-fittings'][0]).toBe(0)
    expect(covered['ss-pipe'][0]).toBe(0)
    expect(covered['pvc-pipe'][0]).toBe(0)
  })

  it('flags the pipe the supplier sells at more than one rate', () => {
    const table = CATALOGUE.find((t) => t.id === 'ms-pipe')!
    const row = table.sheets[0].rows.find((r) => r.fixed.dn === '200')!
    const price = book.resolve(row, {
      table: 'ms-pipe', sheet: 'ms-sheet', variant: 'sch40',
    })

    expect(price.state).toBe('priced')
    expect(price.matchedBy).toBe('spec')
    // Astron approved and Sasol approved are R275 apart on this size.
    expect(price.alternatives).toBeGreaterThan(0)
  })
})

describe('choosing between lines that all fit', () => {
  it('quotes the dearest, because coming up short is the worse mistake', () => {
    const candidates = [
      { description: 'SASOL APPROVED', price: 1285.59 },
      { description: 'ASTRON APPROVED', price: 1560.26 },
      { description: 'ON REQUEST', price: null },
    ].sort(compareCandidates)

    expect(candidates.map((c) => c.price)).toEqual([1560.26, 1285.59, null])
  })
})
