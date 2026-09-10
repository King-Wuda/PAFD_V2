'use client'

import { useEffect, useRef, useState } from 'react'
import { parseStandardCsv } from '@/lib/import/csv'
import { diffPriceList, summariseDiff, type PriceListDiff } from '@/lib/import/diff'
import type { RowError, StandardRow } from '@/lib/import/types'
import { fetchSupplierPrices, importPriceList } from '@/lib/data'
import { DiffReview } from './DiffReview'
import { ChatImportPanel } from './ChatImportPanel'

type Stage = 'choose' | 'review' | 'done'
type Source = 'csv' | 'chat'

const today = () => new Date().toISOString().slice(0, 10)

export function ImportWizard({ suppliers }: { suppliers: string[] }) {
  const [stage, setStage] = useState<Stage>('choose')
  const [source, setSource] = useState<Source>('csv')

  const [supplierName, setSupplierName] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(today())
  const [importedBy, setImportedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [sourceFile, setSourceFile] = useState<string | null>(null)

  const [rows, setRows] = useState<StandardRow[]>([])
  const [diff, setDiff] = useState<PriceListDiff | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importedId, setImportedId] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    // Remember the name so a repeat importer does not retype it. It is a label
    // for the history, not a credential.
    const stored = window.localStorage.getItem('pafd.importedBy')
    if (stored) setImportedBy(stored)
  }, [])

  const canReview = supplierName.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)

  async function toReview(parsedRows: StandardRow[], errors: RowError[]) {
    setError(null)
    setBusy(true)
    try {
      const existing = await fetchSupplierPrices(supplierName.trim())
      setRows(parsedRows)
      setDiff(diffPriceList(parsedRows, existing, errors))
      setStage('review')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function onCsvChosen(file: File) {
    setSourceFile(file.name)
    const parsed = parseStandardCsv(await file.text(), effectiveFrom)
    if (parsed.effectiveFrom) setEffectiveFrom(parsed.effectiveFrom)
    await toReview(parsed.rows, parsed.errors)
  }

  async function write() {
    setBusy(true)
    setError(null)
    try {
      const id = await importPriceList({
        supplierName: supplierName.trim(),
        effectiveFrom,
        sourceFile,
        notes: notes.trim() || null,
        importedBy: importedBy.trim(),
        rows,
      })
      window.localStorage.setItem('pafd.importedBy', importedBy.trim())
      setImportedId(id)
      setStage('done')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
      dialogRef.current?.close()
    }
  }

  if (stage === 'done') {
    return (
      <>
        <h2>Price database updated</h2>
        <p>
          {rows.length} prices recorded for {supplierName}, effective {effectiveFrom}. Everyone
          using the tool will see them on their next reload.
        </p>
        <p className="note">Import {importedId}</p>
        <p>
          <a href="/history">View history</a> — a rollback there restores the previous list in
          one click, and nothing has been deleted.
        </p>
      </>
    )
  }

  return (
    <>
      <h2>Import a price list</h2>

      {error && <p className="banner amber">{error}</p>}

      <fieldset>
        <legend>This import</legend>

        <label className="field">
          <span>Supplier</span>
          <input
            list="suppliers"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Pick an existing supplier or type a new one"
            disabled={stage === 'review'}
          />
          <datalist id="suppliers">
            {suppliers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>Effective from</span>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            disabled={stage === 'review'}
          />
        </label>

        <label className="field">
          <span>Your name — recorded in the history, not a login</span>
          <input
            value={importedBy}
            onChange={(e) => setImportedBy(e.target.value)}
            placeholder="e.g. T. Mashaba"
          />
        </label>

        <label className="field">
          <span>Notes — VAT basis, page range, anything odd</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. excl VAT, pages 3-9 only"
          />
        </label>
      </fieldset>

      {stage === 'choose' && (
        <fieldset>
          <legend>The file</legend>

          <div className="toolbar">
            <button
              className={`action ${source === 'csv' ? 'primary' : ''}`}
              onClick={() => setSource('csv')}
            >
              Standard CSV
            </button>
            <button
              className={`action ${source === 'chat' ? 'primary' : ''}`}
              onClick={() => setSource('chat')}
            >
              Any file, read by chat
            </button>
          </div>

          {source === 'csv' ? (
            <>
              <p className="note">
                Columns: <code>code, description, unit, price, effective_from</code>. A blank
                price means P.O.A. Rows that do not parse are listed, never skipped.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={!canReview || busy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void onCsvChosen(file)
                }}
              />
              {!canReview && (
                <p className="note">Give the supplier and effective date first.</p>
              )}
            </>
          ) : (
            <ChatImportPanel
              supplierName={supplierName}
              effectiveFrom={effectiveFrom}
              disabled={!canReview}
              onRows={(proposed, fileName) => {
                setSourceFile(fileName)
                void toReview(proposed, [])
              }}
            />
          )}
        </fieldset>
      )}

      {stage === 'review' && diff && (
        <>
          <h3>Review — nothing has been written yet</h3>
          <DiffReview diff={diff} />

          <div className="toolbar">
            <button
              className="action primary"
              disabled={busy || rows.length === 0 || importedBy.trim() === ''}
              onClick={() => dialogRef.current?.showModal()}
            >
              Update the price database…
            </button>
            <button className="action" onClick={() => { setStage('choose'); setDiff(null) }}>
              Back
            </button>
            {importedBy.trim() === '' && <span className="note">Add your name first.</span>}
          </div>

          <dialog ref={dialogRef}>
            <h2>Update the price database?</h2>
            <p>
              Supplier: <strong>{supplierName}</strong> · Effective <strong>{effectiveFrom}</strong>
            </p>
            <p>{summariseDiff(diff)}</p>
            <p>This will become the current price list for everyone using the tool.</p>
            <p className="note">Recorded against: {importedBy}</p>
            <div className="buttons">
              <button className="action" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button className="action primary" disabled={busy} onClick={() => void write()}>
                {busy ? 'Writing…' : 'Yes, update'}
              </button>
            </div>
          </dialog>
        </>
      )}
    </>
  )
}
