import type { CatalogueSheet, CatalogueTable } from './types'
import { ROWS } from './rows/pvc-fittings'

/**
 * Every row here carries a supplier code, so this table is priced purely by
 * code-exact match. The fuzzy fallback never runs against it (§10).
 *
 * The old file printed a Price column straight into the table markup, which is
 * exactly the drift this rebuild removes: prices had two homes and grew apart.
 * The column is gone from the catalogue — the app renders the price cell from
 * the loaded price book, by code.
 */
const COLUMNS: CatalogueSheet['columns'] = [
  { key: 'fitting', label: 'Fitting', align: 'left' },
  { key: 'size', label: 'Size', align: 'center' },
  { key: 'code', label: 'Code', align: 'center', mono: true },
  { key: 'note', label: 'Note', align: 'left' },
]

function sheet(id: string, label: string, name: string): CatalogueSheet {
  return { id, label, name, columns: COLUMNS, rows: ROWS[id] ?? [] }
}

export const PVC_FITTINGS: CatalogueTable = {
  id: 'pvc-fittings',
  label: 'PVC Fittings (SW / BSP)',
  name: 'PVC Fittings',
  variants: [{ id: 'x', label: '' }],
  sheetLabel: 'Range:',
  filter: true,
  showPrice: true,
  sheets: [
    sheet('pvcf-sw', 'Solvent weld (PN 16)', 'PVC Fittings - Solvent weld PN 16'),
    sheet('pvcf-bsp', 'BSP threaded (PN 16)', 'PVC Fittings - BSP threaded PN 16'),
    sheet('pvcf-ad', 'Adaptors (plain x BSP)', 'PVC Fittings - Adaptors'),
    sheet('pvcf-anc', 'Ancillaries', 'PVC Fittings - Ancillaries'),
  ],
  sourceNote:
    'uPVC pressure fittings. Sizes are the fitting bore d in mm (solvent weld) or the BSP thread. ' +
    'Solvent weld and threaded fittings have no standard face-to-face geometry, so no drawings ' +
    'are given. Marked items: PN 10 or non-stock but available on request. Pipe prices are quoted ' +
    'on application and are not in this list. ' +
    // The old note named the price list date here. It no longer can: the rates come
    // from the database now, and the header states which list is current.
    'Rates are per the current supplier price list — see the date in the header.',
}
