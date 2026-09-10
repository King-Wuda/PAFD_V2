'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PriceListRecord } from '@/lib/data'
import { setPriceListSuperseded } from '@/lib/data'

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Every import, newest first.
 *
 * Nothing here deletes anything. Rolling back sets superseded = true, which
 * makes the previous list current again; the button then offers to put it back.
 */
export function HistoryView({ lists }: { lists: PriceListRecord[] }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [target, setTarget] = useState<PriceListRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (lists.length === 0) {
    return <p className="empty">No price lists imported yet.</p>
  }

  async function apply() {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      await setPriceListSuperseded(target.id, !target.superseded)
      dialogRef.current?.close()
      setTarget(null)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {error && <p className="banner amber">{error}</p>}

      <div className="table-scroll">
        <table className="catalogue">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Effective from</th>
              <th className="num">Rows</th>
              <th>Imported by</th>
              <th>Imported</th>
              <th>Source</th>
              <th>Notes</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lists.map((list) => (
              <tr key={list.id}>
                <td>{list.supplierName}</td>
                <td>{list.effectiveFrom}</td>
                <td className="num">{list.rowCount}</td>
                <td>{list.importedBy ?? '—'}</td>
                <td>{when(list.importedAt)}</td>
                <td>{list.sourceFile ?? '—'}</td>
                <td style={{ whiteSpace: 'normal' }}>{list.notes ?? ''}</td>
                <td className={list.superseded ? 'flag' : undefined}>
                  {list.superseded ? 'rolled back' : 'in use'}
                </td>
                <td>
                  <Link href={`/history/${list.id}`}>Diff</Link>{' '}
                  <button
                    className="action"
                    onClick={() => {
                      setTarget(list)
                      dialogRef.current?.showModal()
                    }}
                  >
                    {list.superseded ? 'Restore' : 'Roll back'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={dialogRef}>
        <h2>{target?.superseded ? 'Restore this import?' : 'Roll back this import?'}</h2>
        {target && (
          <>
            <p>
              {target.supplierName} · effective {target.effectiveFrom} · {target.rowCount} rows ·
              imported by {target.importedBy ?? 'someone'} on {when(target.importedAt)}
            </p>
            <p>
              {target.superseded
                ? 'It becomes the current list again for everyone using the tool.'
                : 'The previous list becomes current again for everyone using the tool. Nothing is deleted, and you can restore this import at any time.'}
            </p>
          </>
        )}
        <div className="buttons">
          <button className="action" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button className="action primary" disabled={busy} onClick={() => void apply()}>
            {busy ? 'Working…' : target?.superseded ? 'Yes, restore' : 'Yes, roll back'}
          </button>
        </div>
      </dialog>
    </>
  )
}
