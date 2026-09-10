/** A row of the standard CSV. This is the contract every import path produces (§5). */
export interface StandardRow {
  /** Trimmed, upper case, unique within the file. */
  code: string
  description: string
  unit: string
  /** null means P.O.A. */
  price: number | null
}

/** A line that did not parse. Listed to the user, never silently skipped (§6.1). */
export interface RowError {
  /** 1-based line number in the source file. */
  line: number
  raw: string
  reason: string
}

export interface ParseResult {
  rows: StandardRow[]
  errors: RowError[]
  /** ISO date shared by every row, or null if the file did not carry one. */
  effectiveFrom: string | null
}
