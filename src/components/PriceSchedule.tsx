'use client'

import { formatPrice, totalSchedule, type ScheduleLine } from '@/lib/prices/resolve'
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
  onBack,
  onQuantityChange,
  onRemove,
}: {
  lines: ScheduleLine[]
  priceStatus: string
  onBack: () => void
  onQuantityChange: (key: string, quantity: number) => void
  onRemove: (key: string) => void
}) {
  const total = totalSchedule(lines)
  const excluded = total.poaLines.length + total.unpricedLines.length

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
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Amount</th>
                <th className="rm" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const { rowPrice } = line
                const amount = rowPrice.price === null ? null : rowPrice.price * line.quantity

                return (
                  <tr key={line.key}>
                    <td className="desc">
                      <span className="d1">{line.description}</span>
                      {line.code && <span className="mono">{line.code}</span>}
                      {rowPrice.state === 'poa' && (
                        <span className="flag">P.O.A. — excluded</span>
                      )}
                      {rowPrice.state === 'unpriced' && (
                        <span className="flag">no price held — excluded</span>
                      )}
                      {rowPrice.state === 'stale' && <span className="flag">{rowPrice.note}</span>}
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
                        style={{ width: 70, textAlign: 'right' }}
                      />
                    </td>
                    <td className="unit">{rowPrice.unit ?? ''}</td>
                    <td className={`rate${rowPrice.state === 'poa' ? ' price-poa' : ''}`}>
                      {formatPrice(rowPrice)}
                    </td>
                    <td className="total">{amount === null ? '—' : `R ${amount.toFixed(2)}`}</td>
                    <td className="rm">
                      <button
                        className="row-remove"
                        onClick={() => onRemove(line.key)}
                        aria-label={`Remove ${line.description}`}
                        title="Remove from schedule"
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
                <td colSpan={4} style={{ textAlign: 'right' }}>
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
