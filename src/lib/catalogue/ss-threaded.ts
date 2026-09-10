import type { CatalogueColumn, CatalogueSheet, CatalogueTable } from './types'

/**
 * Screwed fittings have no ANSI B 16.9 geometry, so there are no dimensions
 * and no drawings — the range is listed for take-off and pricing only.
 */
const SINGLE: CatalogueColumn[] = [
  { key: 'nps', label: 'NPS (Inches)', align: 'center' },
  { key: 'dn', label: 'DN (mm)', align: 'center' },
  { key: 'pattern', label: 'Pattern', align: 'center' },
]

const PAIRED: CatalogueColumn[] = [
  { key: 'nps', label: 'NPS Range (Inches)', align: 'center' },
  { key: 'dn', label: 'DN Range (mm)', align: 'center' },
  { key: 'pattern', label: 'Pattern', align: 'center' },
]

function sheet(id: string, label: string, columns = SINGLE): CatalogueSheet {
  // PORT PENDING — rows come from Piping_15.html, see docs/PORTING.md
  return { id, label, name: `SS Threaded Fittings - ${label}`, columns, rows: [] }
}

export const SS_THREADED: CatalogueTable = {
  id: 'ss-threaded',
  label: 'SS Threaded (BSP 150 lb)',
  name: 'SS Threaded Fittings',
  variants: [{ id: 'bsp', label: 'BSP 150 lb' }],
  sheetLabel: 'Fitting:',
  sheets: [
    sheet('thr-socket', 'Socket'),
    sheet('thr-union', 'Union'),
    sheet('thr-nipple', 'Nipple'),
    sheet('thr-plug', 'Plug'),
    sheet('thr-bush', 'Reducing Bush', PAIRED),
    sheet('thr-elbow', 'Elbow 90°'),
    sheet('thr-tee', 'Equal Tee'),
  ],
  sourceNote:
    'Stainless SS316 BSP threaded fittings, 150 lb. Screwed fittings have no ANSI B 16.9 ' +
    'geometry, so no dimensions or drawings are given — the range is listed for take-off ' +
    'and pricing.',
}
