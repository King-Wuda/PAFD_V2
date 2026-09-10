/** A row of the `current_prices` view. */
export interface CurrentPrice {
  supplier: string
  code: string
  description: string | null
  unit: string | null
  /** null means P.O.A. — price on application. Never render as R0.00. */
  price: number | null
  /** ISO date of the list this price actually came from. */
  effectiveFrom: string
  priceListId: string
  /** False when the code is absent from the supplier's newest list. */
  onCurrentList: boolean
  /** effective_from of the supplier's newest list, for the staleness note. */
  supplierCurrentFrom: string | null
}

export type PriceState =
  /** Priced from the supplier's current list. */
  | 'priced'
  /** Priced, but the code is absent from the current list (§4.4). */
  | 'stale'
  /** Present with no price. Render "P.O.A.", exclude from totals. */
  | 'poa'
  /** No match. Render blank — never a guess (§10). */
  | 'unpriced'

export interface RowPrice {
  state: PriceState
  price: number | null
  unit: string | null
  supplier: string | null
  /** Date of the list the price came from. */
  effectiveFrom: string | null
  /** How the price was found. 'code' is exact; 'fuzzy' is the guarded fallback. */
  matchedBy: 'code' | 'fuzzy' | null
  /** Code the price was taken from, which may differ from the row's own. */
  matchedCode: string | null
  /** Human note for the cell, e.g. "not on current list (15 Apr 2026)". */
  note: string | null
}

export const UNPRICED: RowPrice = {
  state: 'unpriced',
  price: null,
  unit: null,
  supplier: null,
  effectiveFrom: null,
  matchedBy: null,
  matchedCode: null,
  note: null,
}
