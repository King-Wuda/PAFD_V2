'use client'

import type { PriceChange, PriceListDiff } from '@/lib/import/diff'
import { SUSPICIOUS_THRESHOLD } from '@/lib/import/diff'

function money(value: number | null): string {
  return value === null ? 'P.O.A.' : `R ${value.toFixed(2)}`
}

function delta(change: PriceChange): string {
  if (change.deltaPct === null) return '—'
  const pct = change.deltaPct * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}

/**
 * Everything §6.3 requires the user to see before anything is written.
 * Shown on both import paths, and again on the history page as the diff
 * between an import and the one before it.
 */
export function DiffReview({ diff }: { diff: PriceListDiff }) {
  const threshold = `${(SUSPICIOUS_THRESHOLD * 100).toFixed(0)}%`

  return (
    <>
      <p>
        <strong>{diff.matched}</strong> matched by code · <strong>{diff.changes.length}</strong>{' '}
        changed · <strong>{diff.newCodes.length}</strong> new ·{' '}
        <strong>{diff.missingCodes.length}</strong> not on this list ·{' '}
        <strong>{diff.errors.length}</strong> unreadable
      </p>

      {diff.suspicious.length > 0 && (
        <p className="banner amber">
          <strong>{diff.suspicious.length}</strong>{' '}
          {diff.suspicious.length === 1 ? 'price moves' : 'prices move'} more than {threshold}.
          That is usually a unit or column error rather than a real increase — check these
          before approving.
        </p>
      )}

      {diff.errors.length > 0 && (
        <details open>
          <summary>
            <strong>{diff.errors.length}</strong> rows could not be read
          </summary>
          <div className="table-scroll">
            <table className="catalogue">
              <thead>
                <tr>
                  <th className="num">Line</th>
                  <th>Reason</th>
                  <th>Raw</th>
                </tr>
              </thead>
              <tbody>
                {diff.errors.map((error) => (
                  <tr key={`${error.line}-${error.reason}`}>
                    <td className="num">{error.line}</td>
                    <td className="flag">{error.reason}</td>
                    <td>
                      <code>{error.raw}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {diff.changes.length > 0 && (
        <details open>
          <summary>
            <strong>{diff.changes.length}</strong> price changes, largest move first
          </summary>
          <div className="table-scroll">
            <table className="catalogue">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th className="num">Old</th>
                  <th className="num">New</th>
                  <th className="num">Change</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {diff.changes.map((change) => (
                  <tr key={change.code}>
                    <td>{change.code}</td>
                    <td style={{ whiteSpace: 'normal' }}>{change.description}</td>
                    <td className="num">{money(change.oldPrice)}</td>
                    <td className="num">{money(change.newPrice)}</td>
                    <td className={`num ${change.suspicious ? 'flag' : ''}`}>{delta(change)}</td>
                    <td className={change.suspicious ? 'flag' : 'note'}>
                      {change.suspicious && `over ${threshold} — check`}
                      {change.kind === 'poa-added' && 'now P.O.A.'}
                      {change.kind === 'poa-removed' && 'was P.O.A.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {diff.newCodes.length > 0 && (
        <details>
          <summary>
            <strong>{diff.newCodes.length}</strong> new codes
          </summary>
          <div className="table-scroll">
            <table className="catalogue">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th className="num">Price</th>
                </tr>
              </thead>
              <tbody>
                {diff.newCodes.map((row) => (
                  <tr key={row.code}>
                    <td>{row.code}</td>
                    <td style={{ whiteSpace: 'normal' }}>{row.description}</td>
                    <td>{row.unit}</td>
                    <td className="num">{money(row.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {diff.missingCodes.length > 0 && (
        <details>
          <summary>
            <strong>{diff.missingCodes.length}</strong> codes absent from this list — they keep
            their previous price
          </summary>
          <div className="table-scroll">
            <table className="catalogue">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th className="num">Price kept</th>
                  <th>From</th>
                </tr>
              </thead>
              <tbody>
                {diff.missingCodes.map((entry) => (
                  <tr key={entry.code}>
                    <td>{entry.code}</td>
                    <td style={{ whiteSpace: 'normal' }}>{entry.description ?? ''}</td>
                    <td className="num">{money(entry.keptPrice)}</td>
                    <td>{entry.effectiveFrom ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  )
}
