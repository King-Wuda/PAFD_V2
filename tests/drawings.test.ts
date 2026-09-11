import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { figureForRow, FIG_STYLE } from '@/lib/drawings'
import type { CatalogueRow } from '@/lib/catalogue/types'

function row(over: Partial<CatalogueRow>): CatalogueRow {
  return { id: 'r', title: '2" (50 NB)', fixed: {}, values: {}, ...over }
}

/** Every numeric the generators emit must be finite — NaN silently blanks a figure. */
function hasNoNaN(svg: string) {
  expect(svg).not.toMatch(/NaN|Infinity|undefined/)
}

describe('scale drawings', () => {
  it('draws a 90 degree elbow with its OD, bore, wall and centre-to-end', () => {
    const figure = figureForRow(
      row({
        kind: 'Elbow 90° LR',
        drawing: { kind: 'elbow', od: 60.3, centreToEnd: 76.2, angle: 90, centreLabel: 'A' },
        values: { sch40: { id: '52.50', t: '3.91', m: '0.70' } },
      }),
      'sch40',
      'Sch 40',
    )!
    expect(figure.svg).toContain('<svg')
    expect(figure.svg).toContain('OD 60.3')
    expect(figure.svg).toContain('ID 52.50')
    expect(figure.svg).toContain('A 76.2')
    expect(figure.caption).toBe('2" (50 NB) — Elbow 90° LR')
    expect(figure.spec).toContain('| 0.70 kg')
    expect(figure.spec).toContain('| Sch 40')
    hasNoNaN(figure.svg)
  })

  it('marks the angle rather than a second centre line on a 45 degree elbow', () => {
    const figure = figureForRow(
      row({
        kind: 'Elbow 45° LR',
        drawing: { kind: 'elbow', od: 60.3, centreToEnd: 34.9, angle: 45, centreLabel: 'B' },
        values: { sch40: { id: '52.50', t: '3.91' } },
      }),
      'sch40',
    )!
    expect(figure.svg).toContain('45°')
    hasNoNaN(figure.svg)
  })

  it('splits the paired dimensions of a reducer', () => {
    const figure = figureForRow(
      row({
        kind: 'Concentric reducer',
        drawing: { kind: 'reducer', od: [60.3, 33.4], length: 72.2, eccentric: false },
        values: { sch40: { id: '52.48,26.64', t: '3.91,3.38' } },
      }),
      'sch40',
    )!
    expect(figure.svg).toContain('OD 60.3')
    expect(figure.svg).toContain('OD 33.4')
    expect(figure.svg).toContain('L 72.2')
    expect(figure.spec).toContain('ID 52.48 / 26.64')
    hasNoNaN(figure.svg)
  })

  it('offsets the small end of an eccentric reducer', () => {
    const spec = {
      kind: 'reducer' as const, od: [60.3, 33.4] as [number, number], length: 72.2,
    }
    const values = { sch40: { id: '52.48,26.64', t: '3.91,3.38' } }
    const concentric = figureForRow(row({ drawing: { ...spec, eccentric: false }, values }), 'sch40')!
    const eccentric = figureForRow(row({ drawing: { ...spec, eccentric: true }, values }), 'sch40')!
    expect(eccentric.svg).not.toBe(concentric.svg)
  })

  it('draws a tee with both run and branch bores', () => {
    const figure = figureForRow(
      row({
        kind: 'Reducing tee',
        drawing: { kind: 'tee', od: [60.3, 33.4], a: 63.5, b: 50.8 },
        values: { sch40: { id: '52.48,26.64', t: '3.91,3.38' } },
      }),
      'sch40',
    )!
    expect(figure.svg).toContain('ID 52.48 run')
    expect(figure.svg).toContain('ID 26.64 branch')
    expect(figure.svg).toContain('A 63.5')
    expect(figure.svg).toContain('B 50.8')
    hasNoNaN(figure.svg)
  })

  it('draws a cap with its length E', () => {
    const figure = figureForRow(
      row({
        kind: 'End cap',
        drawing: { kind: 'cap', od: 60.3, length: 38.1 },
        values: { sch40: { id: '52.50', t: '3.90' } },
      }),
      'sch40',
    )!
    expect(figure.svg).toContain('E 38.1')
    hasNoNaN(figure.svg)
  })

  it('draws a pipe end view and quotes mass per metre', () => {
    const figure = figureForRow(
      row({
        drawing: { kind: 'pipe', od: 60.3 },
        values: { sch40: { id: '52.48', t: '3.91', m: '5.43' } },
      }),
      'sch40',
      'Sch 40',
    )!
    expect(figure.caption).toBe('2" (50 NB) — Sch 40')
    expect(figure.spec).toContain('5.43 kg/m')
    hasNoNaN(figure.svg)
  })

  it('draws a flange from the row alone, with no variant values', () => {
    const figure = figureForRow(
      row({
        kind: 'Slip-On flange, ASA 300',
        drawing: {
          kind: 'flange', d: 165, c: 127, rf: 92.1, bore: 61.8, t: 22.3,
          hub: false, weld: false,
        },
        // Single unnamed variant: the value map is empty, and that is correct.
        values: { x: {} },
      }),
      'x',
    )!
    expect(figure.svg).toContain('OD 165')
    expect(figure.svg).toContain('PCD 127.0')
    expect(figure.spec).toContain('bore 61.8')
    hasNoNaN(figure.svg)
  })

  it('says "solid" instead of a bore on a blind flange', () => {
    const figure = figureForRow(
      row({
        drawing: {
          kind: 'flange', d: 318, c: 269.9, rf: 215.9, bore: 0, t: 35,
          hub: false, weld: false,
        },
        values: { x: {} },
      }),
      'x',
    )!
    expect(figure.svg).toContain('solid')
    expect(figure.spec).toContain('| solid')
  })

  it('marks a weld neck flange as WN', () => {
    const figure = figureForRow(
      row({
        drawing: {
          kind: 'flange', d: 255, c: 200, rf: 157.2, bore: 102.3, t: 30.2,
          hub: true, weld: true,
        },
        values: { x: {} },
      }),
      'x',
    )!
    expect(figure.svg).toContain('>WN<')
  })
})

describe('when there is no drawing', () => {
  it('draws nothing for a fitting with no standard geometry', () => {
    // Solvent weld and BSP threaded fittings carry no spec at all.
    expect(figureForRow(row({ code: 'PVCFGO10063', values: { x: {} } }), 'x')).toBeNull()
  })

  it('draws nothing for a size not made in the selected schedule', () => {
    // 22" MS pipe is Sch 80 only; Sch 40 has no wall to draw.
    const pipe = row({
      drawing: { kind: 'pipe', od: 558.8 },
      values: { sch80: { id: '501.64', t: '28.58' } },
    })
    expect(figureForRow(pipe, 'sch80')).not.toBeNull()
    expect(figureForRow(pipe, 'sch40')).toBeNull()
  })
})

/**
 * The figures carry class names, not inline attributes, so they are inert
 * without their stylesheet: every shape falls back to a solid black fill.
 * That shipped once. The export has always injected FIG_STYLE; the app has to
 * as well, and the App Router drops arbitrary children from <head>, so the
 * placement matters and is easy to undo by accident.
 */
describe('the figure stylesheet reaches every surface that draws', () => {
  const read = (path: string) =>
    readFileSync(join(__dirname, '..', 'src', path), 'utf8')

  it('is injected by the app shell', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toContain('FIG_STYLE')
    // In <body>: the App Router owns <head> and silently drops what it does
    // not recognise, which is exactly how this broke.
    expect(layout).not.toMatch(/<head>[\s\S]*FIG_STYLE[\s\S]*<\/head>/)
  })

  it('is injected by the offline export', () => {
    expect(read('lib/export/offline.ts')).toContain('FIG_STYLE')
  })

  it('styles every class the figures actually use', () => {
    const styled = new Set(
      [...FIG_STYLE.matchAll(/\.([a-z]+)\s*\{/g)].map((m) => m[1]),
    )
    for (const cls of ['wall', 'dim', 'ext', 'lead', 'cl', 'dtx', 'figsvg']) {
      expect(styled, `.${cls} has no rule`).toContain(cls)
    }
  })
})
