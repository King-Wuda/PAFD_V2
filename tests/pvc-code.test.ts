import { describe, expect, it } from 'vitest'
import { decodePvcCode, inchesFromThousandths, printedSizeAgrees } from '../extractors/pvc/code'

describe('decoding PVC supplier codes', () => {
  it('reads a single metric size', () => {
    expect(decodePvcCode('PVCFGO10063')).toMatchObject({
      type: 'GO', series: 1, groups: [63], metric: '63mm', label: '63mm',
    })
  })

  it('reads two metric sizes from a reducing fitting', () => {
    expect(decodePvcCode('PVCFTR100630050')).toMatchObject({
      type: 'TR', groups: [63, 50], label: '63 x 50mm',
    })
  })

  it('reads the 315mm reducing bush the PDF printed as "+135"', () => {
    expect(decodePvcCode('PVCFRC103150160')).toMatchObject({ groups: [315, 160] })
  })

  it('reads three groups from an adaptor', () => {
    expect(decodePvcCode('PVCFAM3001200160375')?.groups).toEqual([12, 16, 375])
  })

  it('keeps a trailing letter rather than choking on it', () => {
    expect(decodePvcCode('PVCFBO10016N')).toMatchObject({
      type: 'BO', groups: [16], suffix: 'N',
    })
  })

  it('reads a back nut in inches', () => {
    expect(decodePvcCode('PVCFNU41250')).toMatchObject({ series: 4, label: '1.1/4"' })
  })

  it('is case- and whitespace-insensitive', () => {
    expect(decodePvcCode('  pvcfgo10063 ')?.groups).toEqual([63])
  })

  it.each([
    ['PVCCON1110', 'a different family'],
    ['GALVGBR110', 'the galvanised backing rings'],
    ['PVCFGO1006', 'a truncated size group'],
    ['PVCFRCF10000750', 'a three-letter family with no series digit'],
    ['PVCFFFF1000', 'the BSP full-face flanges'],
    ['PVCFMIL00200500', 'the metric/imperial conversion sockets'],
    ['PVCFPSC0040C', 'the pipe support clips'],
    ['PVCFPTFE', 'a code carrying no size at all'],
  ])('refuses %s — %s', (code) => {
    expect(decodePvcCode(code)).toBeNull()
  })
})

describe('the unit a series implies', () => {
  it('claims millimetres on series 1', () => {
    expect(decodePvcCode('PVCFMA10063')?.label).toBe('63mm')
  })

  it('claims nothing on series 2, whose adaptors mix units', () => {
    // PVCFRC200200375 is "20 mm x 3/8"": first group mm, second inches.
    expect(decodePvcCode('PVCFRC200200375')?.label).toBeNull()
    expect(decodePvcCode('PVCFRC200200375')?.groups).toEqual([20, 375])
  })

  it('claims nothing on series 3 either', () => {
    expect(decodePvcCode('PVCFAF300160375')?.label).toBeNull()
  })

  it('still offers both readings so the caller can choose', () => {
    // 16 mm x 3/8". Read wholly as inches the first group is 2/125", which is
    // nothing anyone stocks — precisely why this series claims no single label.
    const decoded = decodePvcCode('PVCFAF300160375')!
    expect(decoded.metric).toBe('16 x 375mm')
    expect(decoded.inches).toBe('2/125 x 3/8"')
  })

  it.each([
    [375, '3/8'], [1250, '1.1/4'], [1000, '1'],
    [500, '1/2'], [2000, '2'], [750, '3/4'],
  ])('renders %i thousandths of an inch as %s', (thousandths, expected) => {
    expect(inchesFromThousandths(thousandths)).toBe(expected)
  })
})

describe('checking the printed size against the code', () => {
  const bush = decodePvcCode('PVCFRC103150160')!

  it('accepts a printed cell that matches in millimetres', () => {
    expect(printedSizeAgrees(bush, '315 x 160')).toBe(true)
  })

  it('rejects the transposed "+135" the source document actually printed', () => {
    expect(printedSizeAgrees(bush, '+135 x 160')).toBe(false)
  })

  it('accepts an inch cell against an inch code', () => {
    const backNut = decodePvcCode('PVCFNU41250')!
    expect(printedSizeAgrees(backNut, '1.1/4"')).toBe(true)
  })

  it('rejects a size cell with no numbers at all, such as "PN"', () => {
    expect(printedSizeAgrees(decodePvcCode('PVCFGO10063')!, 'PN')).toBe(false)
  })
})
