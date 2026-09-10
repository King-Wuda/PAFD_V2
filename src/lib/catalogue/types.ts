/**
 * Catalogue shape, ported from Piping_15.html.
 *
 * Geometry — sizes, wall thicknesses, schedules, standards, drawing dimensions —
 * is baked in as typed constants. It does not change and it does not belong in
 * the database. Only prices are fetched (§4.1).
 *
 * The old tool has two orthogonal axes, and they must stay separate:
 *
 *   VARIANT   Sch 40 / Sch 80, Class 9 / 12 / 16, 10S / 40S, Medium / Heavy.
 *             Swaps which columns are shown. Each variant carries its OWN tick
 *             state — ticking a 2" pipe on Sch 40 must not tick it on Sch 80,
 *             because they are different products at different prices.
 *
 *   SHEET     Elbow 90 SR / Elbow 90 LR / End Caps / Tees, or the PVC ranges,
 *             or the flange types. Swaps the whole table.
 *
 * Both are scoped to their own table. A single shared selection is what made
 * switching range on SS Threaded blank the A234 table in the old file (§10).
 */

export type TableId =
  | 'ms-pipe'
  | 'ss-pipe'
  | 'pvc-pipe'
  | 'pvc-fittings'
  | 'a234-fittings'
  | 'ss-fittings'
  | 'ss-threaded'
  | 'sans62-pipe'
  | 'sans719-pipe'
  | 'asa300-flanges'

/**
 * A schedule / pressure class. `label` is empty for tables that have only one
 * unnamed variant — those show no variant selector, exactly as before.
 */
export interface CatalogueVariant {
  id: string
  label: string
}

export interface CatalogueColumn {
  /** Key into CatalogueRow.values[variantId]. */
  key: string
  label: string
  /** Spanning heading above this column, e.g. 'Schedule 40'. */
  group?: string
  /**
   * Shown only on this variant. Undefined means the column is shown for every
   * variant — the NPS / DN / OD columns that do not depend on the schedule.
   */
  variant?: string
  align?: 'left' | 'center' | 'right'
  /** Monospace, for supplier codes. */
  mono?: boolean
}

/**
 * A scale drawing, generated from the row's own dimensions so it can never
 * drift from the table beside it. Kinds match the old file's data-fig values.
 *
 * Rows whose fitting has no standard geometry — solvent-weld and BSP threaded
 * fittings — carry no spec at all, and correctly show no drawing.
 */
export type DrawingSpec =
  | { kind: 'pipe'; od: number }
  | { kind: 'elbow'; od: number; centreToEnd: number; angle: 45 | 90; centreLabel: string }
  | { kind: 'reducer'; od: [number, number]; length: number; eccentric: boolean }
  | { kind: 'cap'; od: number; length: number }
  | { kind: 'tee'; od: [number, number]; a: number; b: number }
  | {
      kind: 'flange'
      /** Flange OD. */ d: number
      /** Bolt circle PCD. */ c: number
      /** Raised face diameter. */ rf: number
      /** 0 for a blind flange. */ bore: number
      /** Flange thickness. */ t: number
      hub: boolean
      weld: boolean
    }

/**
 * Dimensions for one variant. Values are kept as the strings the old file
 * printed, so a trailing zero or a '-' survives the port unchanged. Reducers
 * and tees carry a pair as 'large,small'.
 */
export type VariantValues = Record<string, string>

export interface CatalogueRow {
  /** Stable and unique within its sheet. Part of the tick key. */
  id: string
  /**
   * Supplier code. The only key used to price the row — code-exact matching
   * first (§10). Rows without one fall back to the guarded fuzzy matcher,
   * which is allowed to return nothing.
   */
  code?: string
  /** Fitting name, e.g. 'Elbow 90° LR'. Empty for plain pipe rows. */
  kind?: string
  /** Size as printed, e.g. '2" (50 NB)' or '63 mm'. */
  title: string
  /** Supplier remark: 'PN 10', 'non-stock, on request'. */
  note?: string
  drawing?: DrawingSpec
  /**
   * Cells that do not depend on the schedule — NPS, DN, OD, the supplier code.
   * These are the plain cells in the old file; the variant-scoped ones below
   * are the cells it tagged with data-v.
   */
  fixed: VariantValues
  /**
   * Values per variant, then per column key. A variant missing from this map
   * means the row is not made in that schedule — the old file printed '-' and
   * drew no figure. Do not fill it in with zeros.
   */
  values: Record<string, VariantValues>
}

export interface CatalogueSheet {
  id: string
  /** Text on the selector button, e.g. 'Elbow 90° LR'. */
  label: string
  /** Full name used as the heading when copying and printing. */
  name: string
  columns: CatalogueColumn[]
  rows: CatalogueRow[]
}

export interface CatalogueTable {
  id: TableId
  /** Tab button text. */
  label: string
  /** Full name, used in copy and print headings. */
  name: string
  variants: CatalogueVariant[]
  /** Caption on the variant selector, e.g. 'Schedule:'. */
  variantLabel?: string
  sheets: CatalogueSheet[]
  /** Caption on the sheet selector, e.g. 'Fitting:'. Absent for one-sheet tables. */
  sheetLabel?: string
  /** Whether to show the row filter box with its count readout. */
  filter?: boolean
  /**
   * Show a price column in the table itself, as the old file did for PVC
   * fittings. Everything else is costed on the Price Schedule.
   */
  showPrice?: boolean
  /** The grey note under the table. */
  sourceNote: string
}

/** Identifies one tickable cell: a row, on a sheet, at a variant. */
export interface RowKey {
  table: TableId
  sheet: string
  row: string
  variant: string
}

export function rowKey(key: RowKey): string {
  return `${key.table}:${key.sheet}:${key.row}:${key.variant}`
}

/**
 * True when the row is made in that variant.
 *
 * Presence of the key is the test, not whether it holds anything. Tables with a
 * single unnamed variant — PVC fittings, flanges, SS threaded — carry an empty
 * value map for every row, and those rows very much exist. A row genuinely not
 * made in a schedule has the key absent entirely: 22" MS pipe is Sch 80 only,
 * and 80 mm SANS 62 is medium only.
 */
export function hasVariant(row: CatalogueRow, variant: string): boolean {
  return variant in row.values
}

/** Description used for pricing and for the schedule line. */
export function rowDescription(row: CatalogueRow): string {
  return row.kind ? `${row.kind} ${row.title}` : row.title
}
