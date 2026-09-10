import type { CatalogueColumn, CatalogueSheet, CatalogueTable } from './types'

const SCHEDULES = [
  { id: 'sch40', label: 'Sch 40', group: 'Schedule 40' },
  { id: 'sch80', label: 'Sch 80', group: 'Schedule 80' },
]

/** Per-schedule columns, given the labels that sheet uses for ID and wall. */
function perSchedule(idLabel: string, tLabel: string): CatalogueColumn[] {
  return SCHEDULES.flatMap(({ id, group }) => [
    { key: 'id', label: idLabel, group, variant: id, align: 'center' as const },
    { key: 't', label: tLabel, group, variant: id, align: 'center' as const },
    { key: 'm', label: 'Mass (kg)', group, variant: id, align: 'center' as const },
  ])
}

const SINGLE_END: CatalogueColumn[] = [
  { key: 'nps', label: 'NPS (Inches)', align: 'center' },
  { key: 'dn', label: 'DN (mm)', align: 'center' },
  { key: 'od', label: 'Outside dia OD (mm)', align: 'center' },
]

const PAIRED_END: CatalogueColumn[] = [
  { key: 'nps', label: 'NPS Range (Inches)', align: 'center' },
  { key: 'dn', label: 'DN Range (mm)', align: 'center' },
  { key: 'od', label: 'OD Large / Small (mm)', align: 'center' },
]

function sheet(
  id: string, label: string, columns: CatalogueColumn[],
): CatalogueSheet {
  // PORT PENDING — rows come from Piping_15.html, see docs/PORTING.md
  return {
    id,
    label,
    name: `Fittings ASTM A234 WPB - ${label}`,
    columns,
    rows: [],
  }
}

const elbow = (centreLabel: string) => [
  ...SINGLE_END,
  { key: 'ctr', label: `Centre to end ${centreLabel} (mm)`, align: 'center' as const },
  ...perSchedule('Inside dia ID (mm)', 'Wall t (mm)'),
]

const reducer = [
  ...PAIRED_END,
  { key: 'len', label: 'Length L (mm)', align: 'center' as const },
  ...perSchedule('ID Large / Small (mm)', 'Wall t Large / Small (mm)'),
]

export const A234_FITTINGS: CatalogueTable = {
  id: 'a234-fittings',
  label: 'Fittings ASTM A234 WPB',
  name: 'Fittings ASTM A234 WPB',
  variantLabel: 'Schedule:',
  variants: SCHEDULES.map(({ id, label }) => ({ id, label })),
  sheetLabel: 'Fitting:',
  sheets: [
    sheet('elbow-sr-90', 'Elbow 90° SR', elbow('A')),
    sheet('elbow-lr-90', 'Elbow 90° LR', elbow('A')),
    sheet('elbow-45', 'Elbow 45°', elbow('B')),
    sheet('end-caps', 'End Caps', [
      ...SINGLE_END,
      { key: 'len', label: 'Length E (mm)', align: 'center' },
      ...perSchedule('Inside dia ID (mm)', 'Wall t (mm)'),
    ]),
    sheet('conc-reducers', 'Concentric Reducers', reducer),
    sheet('ecc-reducers', 'Eccentric Reducers', reducer),
    sheet('tees', 'T-Pieces', [
      { key: 'nps', label: 'NPS Run x Branch (Inches)', align: 'center' },
      { key: 'dn', label: 'DN Run x Branch (mm)', align: 'center' },
      { key: 'od', label: 'OD Run / Branch (mm)', align: 'center' },
      { key: 'a', label: 'Centre to end A (mm)', align: 'center' },
      { key: 'b', label: 'Centre to end B (mm)', align: 'center' },
      ...perSchedule('ID Run / Branch (mm)', 'Wall t Run / Branch (mm)'),
    ]),
  ],
  sourceNote:
    'Buttweld fittings to ASTM A234 Grade WPB, ANSI B 16.9, short radius elbows to ANSI B 16.28. ' +
    'Reducer and tee wall thicknesses are the matching pipe walls for each end.',
}
