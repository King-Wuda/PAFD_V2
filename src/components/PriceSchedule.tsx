'use client'

import { useMemo, useState } from 'react'
import { formatPrice, totalSchedule, type ScheduleLine } from '@/lib/prices/resolve'
import type { CurrentPrice } from '@/lib/prices/types'
import { GeaLogo } from './PageHead'

/**
 * The costed price schedule — the old file's `#prices-view`.
 *
 * It replaces the dashboard rather than sitting under it, because that is what
 * `viewPrices()` did and because a quote is a different piece of paper from a
 * dimension table.
 *
 * P.O.A. and unpriced lines are listed but excluded from the total, with the
 * exclusion stated on the page. A schedule that quietly totals a P.O.A. item at
 * zero under-quotes the job (§4.4).
 */
export function PriceSchedule({
  lines,
  priceStatus,
  prices,
  matchOverride,
  onMatchChange,
  onBack,
  onQuantityChange,
  onRemove,
}: {
  lines: ScheduleLine[]
  priceStatus: string
  prices: readonly CurrentPrice[]
  matchOverride: Record<string, string>
  onMatchChange: (key: string, code: string) => void
  onBack: () => void
  onQuantityChange: (key: string, quantity: number) => void
  onRemove: (key: string) => void
}) {
  const total = totalSchedule(lines)
  const excluded = total.poaLines.length + total.unpricedLines.length

  /*
   * Lines where the reader has asked to see the full list. A match found on
   * the supplier's own code is exact, so it gets no dropdown at all; the rest
   * get one only when there is genuinely something to choose between, with
   * "change" to open it up for the cases there is not.
   */
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const open = (key: string) =>
    setOpened((previous) => new Set(previous).add(key))

  /*
   * A line needs the dropdown up front when the automatic answer is not
   * trustworthy on its own: nothing was found, or the supplier sells more than
   * one thing that fits. Everything else hides it behind "change".
   */
  const needsChoice = (line: ScheduleLine) =>
    line.rowPrice.state === 'unpriced' ||
    line.rowPrice.matchedBy === 'fuzzy' ||
    line.rowPrice.alternatives > 0

  const label = (price: CurrentPrice) =>
    `${price.description ?? price.code}${
      price.price === null ? ' (P.O.A.)' : ` (R ${price.price.toFixed(2)})`
    }`

  /* Sorted once, not per line — the list runs to several hundred entries. */
  const options = useMemo(
    () =>
      [...prices].sort((a, b) =>
        (a.description ?? a.code).localeCompare(b.description ?? b.code),
      ),
    [prices],
  )

  return (
    <div id="prices-view">
      <div className="price-head">
        <div>
          <h3>Price Schedule</h3>
          <p id="price-meta">{priceStatus}</p>
        </div>
        <div className="brand">
          <GeaLogo />
        </div>
      </div>

      <div className="price-actions">
        <button className="btn-action btn-back" onClick={onBack}>
          &larr; Back to dimensions
        </button>
        <button
          className="btn-action btn-print"
          onClick={() => window.print()}
          disabled={lines.length === 0}
        >
          {'\u{1F5A8}\u{FE0F}'} Print schedule
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="empty">
          Nothing ticked yet. Go back and tick rows in the catalogue to build a schedule.
        </p>
      ) : (
        <>
          <table id="price-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Qty</th>
                <th>Amount</th>
                <th className="rm" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const { rowPrice } = line
                const amount = rowPrice.price === null ? null : rowPrice.price * line.quantity

                return (
                  <tr key={line.key}>
                    <td className="num">{index + 1}</td>
                    <td className="desc">
                      <span className="d1">{line.description}</span>
                      {line.code && <span className="mono">{line.code}</span>}
                      {rowPrice.state === 'poa' && <span className="flag">P.O.A. — excluded</span>}
                      {rowPrice.state === 'unpriced' && (
                        <span className="flag">no price held — excluded</span>
                      )}
                      {rowPrice.state === 'stale' && <span className="flag">{rowPrice.note}</span>}
                      {rowPrice.matchedBy === 'manual' && (
                        <span className="flag matched">chosen by hand</span>
                      )}
                      {rowPrice.matchedBy === 'spec' && rowPrice.alternatives > 0 && (
                        <span className="flag choose">
                          {rowPrice.alternatives} other{rowPrice.alternatives === 1 ? '' : 's'} fit
                          — check this is the right one
                        </span>
                      )}
                      {/*
                        A code match is exact and needs no second-guessing, so
                        it gets no control. Everything else is a judgement the
                        reader can overrule.
                      */}
                      {rowPrice.matchedBy !== 'code' &&
                        (needsChoice(line) || opened.has(line.key) ? (
                          <select
                            className="match-sel"
                            value={matchOverride[line.key] ?? ''}
                            onChange={(e) => onMatchChange(line.key, e.target.value)}
                          >
                            <option value="">
                              {rowPrice.matchedBy === 'spec' || rowPrice.matchedBy === 'fuzzy'
                                ? `— matched automatically: ${rowPrice.matchedCode} —`
                                : '— no price —'}
                            </option>
                            {(line.candidates?.length ?? 0) > 0 && (
                              <optgroup label="Fits this row">
                                {line.candidates!.map((price) => (
                                  <option key={price.code} value={price.code}>
                                    {label(price)}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Every price held">
                              {options.map((price) => (
                                <option key={price.code} value={price.code}>
                                  {label(price)}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        ) : (
                          <button type="button" className="price-reset" onClick={() => open(line.key)}>
                            change
                          </button>
                        ))}
                    </td>
                    <td className="unit">{rowPrice.unit ?? ''}</td>
                    <td className={`rate${rowPrice.state === 'poa' ? ' price-poa' : ''}`}>
                      {formatPrice(rowPrice)}
                    </td>
                    <td className="num">
                      <input
                        className="qty-sel"
                        type="number"
                        min={0}
                        step={1}
                        value={line.quantity}
                        onChange={(e) =>
                          onQuantityChange(line.key, Math.max(0, Number(e.target.value) || 0))
                        }
                        style={{ width: 66, textAlign: 'right' }}
                      />
                    </td>
                    <td className="total">{amount === null ? '—' : `R ${amount.toFixed(2)}`}</td>
                    <td className="rm">
                      <button
                        className="row-remove"
                        onClick={() => onRemove(line.key)}
                        aria-label={`Remove ${line.description}`}
                        title="Remove this line"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}>
                  Total ({total.pricedCount} priced {total.pricedCount === 1 ? 'line' : 'lines'})
                </td>
                <td className="total">R {total.total.toFixed(2)}</td>
                <td className="rm" />
              </tr>
            </tfoot>
          </table>

          {excluded > 0 && (
            <p id="price-warn">
              {excluded} {excluded === 1 ? 'line is' : 'lines are'} not included in this total
              {total.poaLines.length > 0 && ` — ${total.poaLines.length} P.O.A.`}
              {total.unpricedLines.length > 0 &&
                ` — ${total.unpricedLines.length} with no price held`}
              . Price {excluded === 1 ? 'it' : 'them'} before quoting.
            </p>
          )}

          {total.staleLines.length > 0 && (
            <p className="price-foot-note">
              {total.staleLines.length}{' '}
              {total.staleLines.length === 1 ? 'line is' : 'lines are'} priced from an older list —
              the supplier&rsquo;s current list does not carry{' '}
              {total.staleLines.length === 1 ? 'that code' : 'those codes'}.
            </p>
          )}

          <p className="price-foot-note">
            Rates exclude VAT unless the supplier&rsquo;s list says otherwise. Unmatched rows show
            no price rather than a guessed one.
          </p>
        </>
      )}
    </div>
  )
}
