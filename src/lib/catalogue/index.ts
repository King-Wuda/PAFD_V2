import type { CatalogueTable, TableId } from './types'
import { MS_PIPE } from './ms-pipe'
import { SS_PIPE } from './ss-pipe'
import { PVC_PIPE } from './pvc-pipe'
import { PVC_FITTINGS } from './pvc-fittings'
import { A234_FITTINGS } from './a234-fittings'
import { SS_FITTINGS } from './ss-fittings'
import { SS_THREADED } from './ss-threaded'
import { SANS62_PIPE } from './sans62-pipe'
import { SANS719_PIPE } from './sans719-pipe'
import { ASA300_FLANGES } from './asa300-flanges'

/** Tab order, as in the original tool. Port it, don't redesign it (§10). */
export const CATALOGUE: readonly CatalogueTable[] = [
  MS_PIPE,
  SS_PIPE,
  PVC_PIPE,
  PVC_FITTINGS,
  A234_FITTINGS,
  SS_FITTINGS,
  SS_THREADED,
  SANS62_PIPE,
  SANS719_PIPE,
  ASA300_FLANGES,
]

export function getTable(id: TableId): CatalogueTable | undefined {
  return CATALOGUE.find((table) => table.id === id)
}

/**
 * Every row, with the table and sheet it belongs to.
 *
 * A row is counted once here even when it is made in several schedules — this
 * is the catalogue's row count, not the selectable-cell count.
 */
export function allRows() {
  return CATALOGUE.flatMap((table) =>
    table.sheets.flatMap((sheet) =>
      sheet.rows.map((row) => ({ table, sheet, row })),
    ),
  )
}

/** Total catalogue rows — the 1,204 the old tool was signed off against (§15). */
export function rowCount(): number {
  return CATALOGUE.reduce(
    (total, table) => total + table.sheets.reduce((n, sheet) => n + sheet.rows.length, 0),
    0,
  )
}

export * from './types'
