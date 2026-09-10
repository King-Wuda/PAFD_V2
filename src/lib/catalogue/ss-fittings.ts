import type { CatalogueColumn, CatalogueSheet, CatalogueTable } from './types'
import { ROWS } from './rows/ss-fittings'

const SCHEDULES = [
  { id: 'ss10', label: 'Sch 10S', group: 'Schedule 10S' },
  { id: 'ss40', label: 'Sch 40S', group: 'Schedule 40S' },
]

/** The supplier does not quote mass for these, so there is no mass column. */
function perSchedule(idLabel: string, tLabel: string): CatalogueColumn[] {
  return SCHEDULES.flatMap(({ id, group }) => [
    { key: 'id', label: idLabel, group, variant: id, align: 'center' as const },
    { key: 't', label: tLabel, group, variant: id, align: 'center' as const },
  ])
}

function sheet(id: string, label: string, columns: CatalogueColumn[]): CatalogueSheet {
  return { id, label, name: `SS Fittings 304L / 316L - ${label}`, columns, rows: ROWS[id] ?? [] }
}

const SINGLE_END: CatalogueColumn[] = [
  { key: 'nps', label: 'NPS (Inches)', align: 'center' },
  { key: 'dn', label: 'DN (mm)', align: 'center' },
  { key: 'od', label: 'Outside dia OD (mm)', align: 'center' },
]

export const SS_FITTINGS: CatalogueTable = {
  id: 'ss-fittings',
  label: 'SS Fittings (304L / 316L)',
  name: 'SS Fittings 304L / 316L',
  variantLabel: 'Schedule:',
  variants: SCHEDULES.map(({ id, label }) => ({ id, label })),
  sheetLabel: 'Fitting:',
  sheets: [
    sheet('ss-elbow-90', 'Elbow 90° LR', [
      ...SINGLE_END,
      { key: 'ctr', label: 'Centre to end A (mm)', align: 'center' },
      ...perSchedule('Inside dia ID (mm)', 'Wall t (mm)'),
    ]),
    sheet('ss-tee', 'Equal Tee', [
      ...SINGLE_END,
      { key: 'a', label: 'Centre to end A (mm)', align: 'center' },
      { key: 'b', label: 'Centre to end B (mm)', align: 'center' },
      ...perSchedule('Inside dia ID (mm)', 'Wall t (mm)'),
    ]),
    sheet('ss-reducer', 'Concentric Reducer', [
      { key: 'nps', label: 'NPS Range (Inches)', align: 'center' },
      { key: 'dn', label: 'DN Range (mm)', align: 'center' },
      { key: 'od', label: 'OD Large / Small (mm)', align: 'center' },
      { key: 'len', label: 'Length L (mm)', align: 'center' },
      ...perSchedule('ID Large / Small (mm)', 'Wall t Large / Small (mm)'),
    ]),
  ],
  sourceNote:
    'Stainless buttweld fittings, grades ASTM A403 WP 304L and 316L. Geometry to ANSI B 16.9, ' +
    'wall thickness to ANSI B 36.19 Sch 10S / 40S, inside diameter calculated as OD − 2t. ' +
    'Range as stocked; mass is not quoted by the supplier.',
}
