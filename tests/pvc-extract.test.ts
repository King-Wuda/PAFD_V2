import { describe, expect, it } from 'vitest'
import { extract } from '../extractors/pvc/extract'

/** A layout-preserved page, as pdftotext -layout produces it. */
const PAGE = [
  'ELBOWS 90 DEGREE',
  '',
  '  Size        Code               Price',
  '  63          PVCFGO10063        64.49',
  '  63 x 50     PVCFTR100630050    96.37',
  '  +135 x 160  PVCFRC103150160    P.O.A.',
  '  110         PVCCON1110         1 234,56',
  '  20          PVCFGO10020        see note',
  '',
].join('\n')

describe('the PVC extractor', () => {
  const { rows, skipped } = extract(PAGE)

  it('finds the coded rows and their prices', () => {
    expect(rows.map((row) => row.code)).toEqual([
      'PVCFGO10063', 'PVCFTR100630050', 'PVCFRC103150160', 'PVCCON1110',
    ])
    expect(rows[0].price).toBe(64.49)
    expect(rows[1].price).toBe(96.37)
  })

  it('reads P.O.A. as no price rather than zero', () => {
    expect(rows[2].price).toBeNull()
  })

  it('takes the size from the code, not the wrong printed cell', () => {
    expect(rows[2].description).toBe('RC 315 x 160mm')
    expect(rows[2].printedSize).toBe('+135 x 160')
  })

  it('takes codes whose size it cannot decode, keeping the printed size', () => {
    // PVCCON tank connectors are real priced lines and must reach the seed.
    // The decoder cannot read their size, so the printed cell is kept as-is
    // rather than a size being invented from the code.
    const connector = rows.find((row) => row.code === 'PVCCON1110')
    expect(connector).toBeDefined()
    expect(connector!.price).toBe(1234.56)
    expect(connector!.description).toContain('110')
  })

  it('reports a row it could not price instead of dropping it silently', () => {
    expect(skipped).toHaveLength(1)
    expect(skipped[0]).toContain('PVCFGO10020')
    expect(skipped[0]).toContain('see note')
  })
})
