import { describe, expect, it } from 'vitest'
import { parseStandardCsv } from '@/lib/import/csv'

const HEADER = 'code,description,unit,price,effective_from'

describe('the standard CSV contract', () => {
  it('parses the example from the brief', () => {
    const result = parseStandardCsv([
      HEADER,
      'PVCFGO10063,90 deg elbow 63mm SW,each,64.49,2026-04-15',
      'PVCFTR100630050,Reducing tee 63x50mm SW,each,96.37,2026-04-15',
      'PVCCON1110,VDL tank connector 110mm,each,,2026-04-15',
    ].join('\n'))

    expect(result.errors).toEqual([])
    expect(result.effectiveFrom).toBe('2026-04-15')
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0]).toEqual({
      code: 'PVCFGO10063', description: '90 deg elbow 63mm SW', unit: 'each', price: 64.49,
    })
  })

  it('reads a blank price as P.O.A., not zero', () => {
    const result = parseStandardCsv(`${HEADER}\nPVCCON1110,tank connector,each,,2026-04-15`)
    expect(result.rows[0].price).toBeNull()
  })

  it('upper-cases and trims codes', () => {
    const result = parseStandardCsv(`${HEADER}\n  pvcfgo10063 ,elbow,each,1.00,2026-04-15`)
    expect(result.rows[0].code).toBe('PVCFGO10063')
  })

  it('reports a duplicate code instead of overwriting it', () => {
    const result = parseStandardCsv([
      HEADER,
      'DUP,first,each,1.00,2026-04-15',
      'DUP,second,each,2.00,2026-04-15',
    ].join('\n'))
    expect(result.rows).toHaveLength(1)
    expect(result.errors[0].reason).toContain('duplicate code DUP')
    expect(result.errors[0].line).toBe(3)
  })

  it('lists unparseable rows rather than skipping them silently', () => {
    const result = parseStandardCsv([
      HEADER,
      'GOOD,fine,each,1.00,2026-04-15',
      'BAD,broken,each,not-a-number,2026-04-15',
      ',no code,each,1.00,2026-04-15',
    ].join('\n'))
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0].raw).toContain('not-a-number')
    expect(result.errors[1].reason).toBe('code is blank')
  })

  it('refuses two effective dates in one file', () => {
    const result = parseStandardCsv([
      HEADER,
      'A,a,each,1.00,2026-04-15',
      'B,b,each,2.00,2026-05-01',
    ].join('\n'))
    expect(result.errors[0].reason).toContain('one date per file')
  })

  it('falls back to the date typed on the import screen', () => {
    const result = parseStandardCsv('code,description,unit,price\nA,a,each,1.00', '2026-10-01')
    expect(result.effectiveFrom).toBe('2026-10-01')
  })

  it('rejects a file missing a required column', () => {
    const result = parseStandardCsv('code,description\nA,a')
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0].reason).toContain('missing required column(s): unit, price')
  })

  it('handles quoted descriptions containing commas', () => {
    const result = parseStandardCsv(`${HEADER}\nA,"Tee, reducing 63x50",each,96.37,2026-04-15`)
    expect(result.rows[0].description).toBe('Tee, reducing 63x50')
  })
})
