import type { CatalogueRow, VariantValues } from '@/lib/catalogue/types'
import {
  FIG_STYLE, figCap, figElbow, figFlange, figPipe, figReducer, figTee, num,
} from './geometry'

export { FIG_STYLE }

export interface Figure {
  /** SVG markup, generated from catalogue numbers only. */
  svg: string
  caption: string
  /** The dimension line under the caption. */
  spec: string
}

/** 'a,b' -> [a, b]; a single value -> [a, a]. */
function pair(value: string | undefined): [number, number] {
  const parts = String(value ?? '').split(',').map(Number)
  return [parts[0], parts.length > 1 ? parts[1] : parts[0]]
}

/**
 * The drawing for one row at one variant, or null when there is none.
 *
 * Returns null in two distinct cases, and both are correct:
 *   - the fitting has no standard geometry (solvent weld, BSP threaded), so the
 *     row carries no drawing spec at all;
 *   - the row is not made in this schedule, so it has no wall thickness.
 * Neither is an error, and neither should draw a misleading generic shape.
 */
export function figureForRow(
  row: CatalogueRow,
  variantId: string,
  variantLabel = '',
): Figure | null {
  const spec = row.drawing
  if (!spec) return null

  const tail = variantLabel ? ` | ${variantLabel}` : ''

  // Flanges carry every dimension on the row itself, not in the variant values,
  // so they are drawn before the wall-thickness guard below.
  if (spec.kind === 'flange') {
    return {
      svg: figFlange(spec),
      caption: `${row.title} — ${row.kind ?? 'Flange'}`,
      spec:
        `OD ${num(spec.d, 0)} | PCD ${num(spec.c, 1)} | RF ø ${num(spec.rf, 1)}` +
        (spec.bore > 0 ? ` | bore ${num(spec.bore, 1)}` : ' | solid') +
        ` | t ${num(spec.t, 1)}`,
    }
  }

  const values: VariantValues | undefined = row.values[variantId]
  if (!values || !values.t) return null

  const mass = values.m ? ` | ${num(Number(values.m))} kg` : ''
  const withKind = `${row.title} — ${row.kind ?? ''}`.trim().replace(/ —$/, '')

  switch (spec.kind) {
    case 'elbow': {
      const id = Number(values.id), t = Number(values.t)
      return {
        svg: figElbow({
          od: spec.od, id, t,
          centreToEnd: spec.centreToEnd,
          angle: spec.angle,
          centreLabel: spec.centreLabel,
        }),
        caption: withKind,
        spec:
          `OD ${num(spec.od, 1)} | ID ${num(id)} | t ${num(t)}` +
          ` | ${spec.centreLabel} ${num(spec.centreToEnd, 1)}${mass}${tail}`,
      }
    }
    case 'reducer': {
      const [t1, t2] = pair(values.t)
      const [id1, id2] = pair(values.id)
      return {
        svg: figReducer({
          length: spec.length,
          od1: spec.od[0], od2: spec.od[1],
          id1, id2, t1, t2,
          eccentric: spec.eccentric,
        }),
        caption: withKind,
        spec:
          `OD ${num(spec.od[0], 1)} / ${num(spec.od[1], 1)} | ID ${num(id1)} / ${num(id2)}` +
          ` | t ${num(t1)} / ${num(t2)} | L ${num(spec.length, 1)}${mass}${tail}`,
      }
    }
    case 'cap': {
      const id = Number(values.id), t = Number(values.t)
      return {
        svg: figCap({ length: spec.length, od: spec.od, id, t }),
        caption: withKind,
        spec:
          `OD ${num(spec.od, 1)} | ID ${num(id)} | t ${num(t)}` +
          ` | E ${num(spec.length, 1)}${mass}${tail}`,
      }
    }
    case 'tee': {
      const [tr, tb] = pair(values.t)
      const [idr, idb] = pair(values.id)
      return {
        svg: figTee({
          a: spec.a, b: spec.b,
          odr: spec.od[0], odb: spec.od[1],
          idr, idb, tr,
        }),
        caption: withKind,
        spec:
          `OD ${num(spec.od[0], 1)} / ${num(spec.od[1], 1)} | ID ${num(idr)} / ${num(idb)}` +
          ` | t ${num(tr)} / ${num(tb)} | A ${num(spec.a, 1)} | B ${num(spec.b, 1)}${mass}${tail}`,
      }
    }
    case 'pipe': {
      const id = Number(values.id), t = Number(values.t)
      return {
        svg: figPipe({ od: spec.od, id, t }),
        caption: row.title + (variantLabel ? ` — ${variantLabel}` : ''),
        spec:
          `OD ${num(spec.od, 1)} | ID ${num(id)} | t ${num(t)}` +
          (values.m ? ` | ${values.m} kg/m` : '') + tail,
      }
    }
  }
}
