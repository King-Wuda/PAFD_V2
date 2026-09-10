import type { CatalogueSheet, CatalogueTable } from './types'
import { ROWS } from './rows/asa300-flanges'

const COLUMNS: CatalogueSheet['columns'] = [
  { key: 'nps', label: 'NPS (Inches)', align: 'center' },
  { key: 'dn', label: 'DN (mm)', align: 'center' },
  { key: 'flangeOd', label: 'Flange OD (mm)', align: 'center' },
  { key: 'pcd', label: 'Bolt circle PCD (mm)', align: 'center' },
  { key: 'rf', label: 'Raised face ø (mm)', align: 'center' },
  { key: 'thk', label: 'Thickness t (mm)', align: 'center' },
]

function sheet(id: string, label: string): CatalogueSheet {
  return { id, label, name: `ASA 300 Flanges - ${label}`, columns: COLUMNS, rows: ROWS[id] ?? [] }
}

export const ASA300_FLANGES: CatalogueTable = {
  id: 'asa300-flanges',
  label: 'Flanges (ASA 300)',
  name: 'ASA 300 Flanges',
  variants: [{ id: 'x', label: '' }],
  sheetLabel: 'Flange type:',
  sheets: [
    sheet('flange-so', 'Slip-On'),
    sheet('flange-wn40', 'Weld Neck (bore Sch 40)'),
    sheet('flange-wn80', 'Weld Neck (bore Sch 80)'),
    sheet('flange-wn160', 'Weld Neck (bore Sch 160)'),
    sheet('flange-bld', 'Blind'),
  ],
  sourceNote:
    'Forged flanges to ASME/ANSI B16.5 Class 300 (ASA 300), raised face, material ASTM A105. ' +
    'Flange OD, bolt circle, raised-face diameter and thickness from B16.5. Weld-neck bores ' +
    'follow the stated schedule; slip-on bores suit the pipe OD.',
}
