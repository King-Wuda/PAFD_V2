import type { RowError, StandardRow } from './types'

/** Anything with a code and a price — a current_prices row or a historic list. */
export interface PricedCode {
  code: string
  description?: string | null
  price: number | null
  effectiveFrom?: string
}

export type ChangeKind =
  | 'price'
  /** Was priced, is now P.O.A. */
  | 'poa-added'
  /** Was P.O.A., now carries a price. */
  | 'poa-removed'

export interface PriceChange {
  code: string
  description: string
  kind: ChangeKind
  oldPrice: number | null
  newPrice: number | null
  /** Fractional change, e.g. 0.25 for +25%. Null when either side is P.O.A. */
  deltaPct: number | null
  /**
   * A move past ±20%. Usually a unit or column error rather than a real
   * increase — it is worth a second look before approving (§6.3).
   */
  suspicious: boolean
}

export interface MissingCode extends PricedCode {
  /** Kept at its previous price and flagged, never dropped (§4.4). */
  keptPrice: number | null
}

export interface PriceListDiff {
  /** Incoming codes that already exist for this supplier. */
  matched: number
  /** Matched codes whose price is identical. */
  unchanged: number
  /** Old → new, sorted by largest absolute move first. */
  changes: PriceChange[]
  /** Codes not previously seen from this supplier. */
  newCodes: StandardRow[]
  /** Codes we hold that this file does not carry. */
  missingCodes: MissingCode[]
  /** Lines that did not parse — shown, not swallowed. */
  errors: RowError[]
  /** Subset of `changes` past the ±20% threshold. */
  suspicious: PriceChange[]
  /** Total rows in the incoming file that parsed. */
  incomingCount: number
}

export const SUSPICIOUS_THRESHOLD = 0.2

function classify(
  code: string,
  description: string,
  oldPrice: number | null,
  newPrice: number | null,
): PriceChange | null {
  if (oldPrice === null && newPrice === null) return null
  if (oldPrice !== null && newPrice !== null && oldPrice === newPrice) return null

  if (oldPrice === null) {
    return {
      code, description, kind: 'poa-removed',
      oldPrice: null, newPrice, deltaPct: null, suspicious: false,
    }
  }
  if (newPrice === null) {
    return {
      code, description, kind: 'poa-added',
      oldPrice, newPrice: null, deltaPct: null, suspicious: false,
    }
  }

  // A previous price of zero has no meaningful percentage; treat any move off
  // it as worth checking.
  const deltaPct = oldPrice === 0 ? null : (newPrice - oldPrice) / oldPrice
  return {
    code, description, kind: 'price',
    oldPrice, newPrice, deltaPct,
    suspicious: deltaPct === null || Math.abs(deltaPct) > SUSPICIOUS_THRESHOLD,
  }
}

/**
 * Compare an incoming file against what we already hold for that supplier.
 *
 * Produces everything §6.3 requires the user to see before a single row is
 * written. This function touches no database and decides nothing — it reports.
 */
export function diffPriceList(
  incoming: readonly StandardRow[],
  existing: readonly PricedCode[],
  errors: readonly RowError[] = [],
): PriceListDiff {
  const existingByCode = new Map<string, PricedCode>()
  for (const entry of existing) {
    existingByCode.set(entry.code.trim().toUpperCase(), entry)
  }

  const incomingCodes = new Set<string>()
  const changes: PriceChange[] = []
  const newCodes: StandardRow[] = []
  let matched = 0
  let unchanged = 0

  for (const row of incoming) {
    const code = row.code.trim().toUpperCase()
    incomingCodes.add(code)

    const previous = existingByCode.get(code)
    if (!previous) {
      newCodes.push(row)
      continue
    }

    matched++
    const change = classify(
      code,
      row.description || previous.description || '',
      previous.price,
      row.price,
    )
    if (change) changes.push(change)
    else unchanged++
  }

  const missingCodes: MissingCode[] = []
  for (const [code, entry] of existingByCode) {
    if (!incomingCodes.has(code)) {
      missingCodes.push({ ...entry, code, keptPrice: entry.price })
    }
  }

  const magnitude = (c: PriceChange) => (c.deltaPct === null ? Infinity : Math.abs(c.deltaPct))
  changes.sort((a, b) => magnitude(b) - magnitude(a))

  return {
    matched,
    unchanged,
    changes,
    newCodes,
    missingCodes,
    errors: [...errors],
    suspicious: changes.filter((c) => c.suspicious),
    incomingCount: incoming.length,
  }
}

/** The one-line summary shown in the confirmation dialogue (§7). */
export function summariseDiff(diff: PriceListDiff): string {
  const parts = [
    `${diff.matched} prices matched`,
    `${diff.changes.length} changed`,
    `${diff.newCodes.length} new`,
    `${diff.missingCodes.length} not on this list`,
  ]
  return parts.join(' · ')
}
