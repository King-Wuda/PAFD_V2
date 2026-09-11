import { rowDescription, type CatalogueRow } from '@/lib/catalogue/types'
import { fuzzyMatch } from './match'
import { UNPRICED, type CurrentPrice, type RowPrice } from './types'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]} ${y}`
}

/**
 * Indexed view of the current price data, built once per page load.
 */
export class PriceBook {
  private readonly byCode = new Map<string, CurrentPrice>()
  private readonly entries: readonly CurrentPrice[]

  constructor(entries: readonly CurrentPrice[]) {
    this.entries = entries
    for (const entry of entries) {
      const key = entry.code.trim().toUpperCase()
      const existing = this.byCode.get(key)
      // The view is already deduplicated per supplier; if two suppliers carry
      // the same code, keep the one from the more recent list.
      if (!existing || entry.effectiveFrom > existing.effectiveFrom) {
        this.byCode.set(key, entry)
      }
    }
  }

  get size(): number {
    return this.byCode.size
  }

  /** Newest effective_from across all loaded prices, for the freshness header. */
  get currentEffectiveFrom(): string | null {
    let newest: string | null = null
    for (const entry of this.entries) {
      const date = entry.supplierCurrentFrom ?? entry.effectiveFrom
      if (!newest || date > newest) newest = date
    }
    return newest
  }

  lookupByCode(code: string): CurrentPrice | null {
    return this.byCode.get(code.trim().toUpperCase()) ?? null
  }

  /** Every loaded price, for the schedule's match dropdown. */
  get all(): readonly CurrentPrice[] {
    return this.entries
  }

  /**
   * Price a line from a code the user chose by hand.
   *
   * Kept apart from `resolve` on purpose: this is the one path where a price
   * reaches a row that the matcher would not have given it, so it is labelled
   * 'manual' and the schedule says so.
   */
  resolveCode(code: string): RowPrice {
    const entry = this.lookupByCode(code)
    return entry ? this.toRowPrice(entry, 'manual') : UNPRICED
  }

  /**
   * Price one catalogue row.
   *
   * Code-exact first, always. The fuzzy fallback runs only when the row has no
   * code at all — never as a second chance for a code that missed, because a
   * code that missed means we genuinely do not have that price.
   */
  resolve(row: CatalogueRow): RowPrice {
    if (row.code) {
      const entry = this.lookupByCode(row.code)
      return entry ? this.toRowPrice(entry, 'code') : UNPRICED
    }

    const entry = fuzzyMatch(rowDescription(row), this.entries)
    return entry ? this.toRowPrice(entry, 'fuzzy') : UNPRICED
  }

  private toRowPrice(entry: CurrentPrice, matchedBy: 'code' | 'fuzzy' | 'manual'): RowPrice {
    const stale = !entry.onCurrentList
    const state = entry.price === null ? 'poa' : stale ? 'stale' : 'priced'

    return {
      state,
      price: entry.price,
      unit: entry.unit,
      supplier: entry.supplier,
      effectiveFrom: entry.effectiveFrom,
      matchedBy,
      matchedCode: entry.code,
      note: stale
        ? `not on current list — price from ${formatDate(entry.effectiveFrom)}`
        : null,
    }
  }
}

/** Cell text. P.O.A. is never R0.00; an unmatched row is never a guess. */
export function formatPrice(rowPrice: RowPrice): string {
  if (rowPrice.state === 'poa') return 'P.O.A.'
  if (rowPrice.price === null) return ''
  return `R ${rowPrice.price.toFixed(2)}`
}

/**
 * One line of the price schedule.
 *
 * Deliberately not a CatalogueRow: a row that is made in two schedules is two
 * different products at two different prices, so the line carries the already
 * resolved description and price rather than a reference back to the row.
 */
export interface ScheduleLine {
  /** rowKey() of the ticked cell — table, sheet, row and variant. */
  key: string
  description: string
  code: string | null
  quantity: number
  rowPrice: RowPrice
}

export interface ScheduleTotal {
  total: number
  /** Lines with a real price, included in the total. */
  pricedCount: number
  /** P.O.A. lines — excluded from the total, shown with a note (§4.4). */
  poaLines: ScheduleLine[]
  /** Lines we have no price for at all — also excluded. */
  unpricedLines: ScheduleLine[]
  /** Priced, but off an older list. Counted, but worth flagging. */
  staleLines: ScheduleLine[]
}

/**
 * Total a price schedule.
 *
 * P.O.A. and unpriced lines are excluded from the total and returned
 * separately so the schedule can say so out loud rather than quietly
 * under-quoting the job.
 */
export function totalSchedule(lines: readonly ScheduleLine[]): ScheduleTotal {
  const result: ScheduleTotal = {
    total: 0,
    pricedCount: 0,
    poaLines: [],
    unpricedLines: [],
    staleLines: [],
  }

  for (const line of lines) {
    switch (line.rowPrice.state) {
      case 'poa':
        result.poaLines.push(line)
        break
      case 'unpriced':
        result.unpricedLines.push(line)
        break
      case 'stale':
        result.staleLines.push(line)
        result.total += (line.rowPrice.price ?? 0) * line.quantity
        result.pricedCount++
        break
      case 'priced':
        result.total += (line.rowPrice.price ?? 0) * line.quantity
        result.pricedCount++
        break
    }
  }

  result.total = Math.round(result.total * 100) / 100
  return result
}

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000

/** §9: amber header when the current list is older than twelve months. */
export function stalenessWarning(
  effectiveFrom: string | null,
  now: Date = new Date(),
): string | null {
  if (!effectiveFrom) return null
  const age = now.getTime() - new Date(effectiveFrom).getTime()
  if (age < TWELVE_MONTHS_MS) return null
  return `Prices from ${formatDate(effectiveFrom)} — may be out of date.`
}

export { formatDate }
