'use client'

import { formatPrice, totalSchedule, type ScheduleLine } from '@/lib/prices/resolve'

/**
 * The costed price schedule.
 *
 * P.O.A. and unpriced lines are listed but excluded from the total, with the
 * exclusion stated on the page. A schedule that quietly totals a P.O.A. item
 * at zero under-quotes the job (§4.4).
 */
export function PriceSchedule({
  lines,
  onQuantityChange,
}: {
  lines: ScheduleLine[]
  onQuantityChange: (key: string, quantity: number) => void
}) {
  if (lines.length === 0) {
    return <p className="empty">Tick rows in the catalogue to build a price schedule.</p>
  }

  const total = totalSchedule(lines)
  const excluded = total.poaLines.length + total.unpricedLines.length

  return (
    <section className="print-block">
      <div className="table-scroll">
        <table className="catalogue">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th className="num">Qty</th>
              <th>Unit</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const { rowPrice } = line
              const amount =
                rowPrice.price === null ? null : rowPrice.price * line.quantity

              return (
                <tr key={line.key}>
                  <td className="mono">{line.code ?? ''}</td>
                  <td style={{ whiteSpace: 'normal' }}>{line.description}</td>
                  <td className="num">
                    <input
                      className="no-print"
                      type="number"
                      min={0}
                      step={1}
                      value={line.quantity}
                      onChange={(e) =>
                        onQuantityChange(line.key, Math.max(0, Number(e.target.value) || 0))
                      }
                      style={{ width: 70, font: 'inherit', textAlign: 'right' }}
                    />
                    <span className="print-only">{line.quantity}</span>
                  </td>
                  <td>{rowPrice.unit ?? ''}</td>
                  <td className={`num ${rowPrice.state === 'poa' ? 'price-poa' : ''}`}>
                    {formatPrice(rowPrice)}
                  </td>
                  <td className="num">
                    {amount === null ? '—' : `R ${amount.toFixed(2)}`}
                  </td>
                  <td className="note">
                    {rowPrice.state === 'poa' && 'P.O.A. — excluded from total'}
                    {rowPrice.state === 'unpriced' && 'no price held — excluded from total'}
                    {rowPrice.state === 'stale' && rowPrice.note}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={5} style={{ textAlign: 'right' }}>
                Total ({total.pricedCount} priced {total.pricedCount === 1 ? 'line' : 'lines'})
              </th>
              <th className="num">R {total.total.toFixed(2)}</th>
              <th />
            </tr>
          </tfoot>
        </table>
      </div>

      {excluded > 0 && (
        <p className="banner amber" style={{ marginTop: 10 }}>
          {excluded} {excluded === 1 ? 'line is' : 'lines are'} not included in this total
          {total.poaLines.length > 0 && ` — ${total.poaLines.length} P.O.A.`}
          {total.unpricedLines.length > 0 && ` — ${total.unpricedLines.length} with no price held`}
          . Price {excluded === 1 ? 'it' : 'them'} before quoting.
        </p>
      )}

      {total.staleLines.length > 0 && (
        <p className="note" style={{ marginTop: 6 }}>
          {total.staleLines.length}{' '}
          {total.staleLines.length === 1 ? 'line is' : 'lines are'} priced from an older list —
          the supplier&rsquo;s current list does not carry{' '}
          {total.staleLines.length === 1 ? 'that code' : 'those codes'}.
        </p>
      )}
    </section>
  )
}
