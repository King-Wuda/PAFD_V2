'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CATALOGUE } from '@/lib/catalogue'
import type {
  CatalogueRow, CatalogueSheet, CatalogueTable, TableId,
} from '@/lib/catalogue/types'
import { hasVariant, rowDescription, rowKey } from '@/lib/catalogue/types'
import { PriceBook, stalenessWarning, type ScheduleLine } from '@/lib/prices/resolve'
import type { CurrentPrice } from '@/lib/prices/types'
import { fetchLatestImportedAt } from '@/lib/data'
import { CatalogueTableView, visibleColumns } from './CatalogueTableView'
import { PriceSchedule } from './PriceSchedule'

/** How often to ask whether someone else has imported a list. */
const FRESHNESS_POLL_MS = 5 * 60 * 1000

function matchesFilter(row: CatalogueRow, variant: string, needle: string): boolean {
  if (needle === '') return true
  const haystack = [
    row.code, row.kind, row.title, row.note,
    ...Object.values(row.fixed),
    ...Object.values(row.values[variant] ?? {}),
  ].join(' ').toLowerCase()
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
}

export function Dashboard({
  prices,
  configured,
  loadedAt,
}: {
  prices: CurrentPrice[]
  configured: boolean
  loadedAt: string | null
}) {
  const priceBook = useMemo(() => new PriceBook(prices), [prices])

  const [activeTableId, setActiveTableId] = useState<TableId>(CATALOGUE[0].id)
  /**
   * Selected sheet and variant, both keyed by table id.
   *
   * Deliberately per-table. A single shared value is what made switching range
   * on SS Threaded blank the A234 table in the old file (§10).
   */
  const [sheetByTable, setSheetByTable] = useState<Partial<Record<TableId, string>>>({})
  const [variantByTable, setVariantByTable] = useState<Partial<Record<TableId, string>>>({})
  const [filterByTable, setFilterByTable] = useState<Partial<Record<TableId, string>>>({})

  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [showDrawings, setShowDrawings] = useState(false)
  const [newListAvailable, setNewListAvailable] = useState(false)
  const [copied, setCopied] = useState(false)

  const table = useMemo(
    () => CATALOGUE.find((t) => t.id === activeTableId) as CatalogueTable,
    [activeTableId],
  )
  const sheet = useMemo(
    () =>
      table.sheets.find((s) => s.id === sheetByTable[table.id]) ?? table.sheets[0],
    [table, sheetByTable],
  )
  const variant = variantByTable[table.id] ?? table.variants[0].id
  const variantLabel = table.variants.find((v) => v.id === variant)?.label ?? ''
  const filter = filterByTable[table.id] ?? ''

  /** Rows on this sheet that are made in the selected schedule. */
  const rowsInVariant = useMemo(
    () => sheet.rows.filter((row) => hasVariant(row, variant)),
    [sheet, variant],
  )
  const visibleRows = useMemo(
    () => rowsInVariant.filter((row) => matchesFilter(row, variant, filter)),
    [rowsInVariant, variant, filter],
  )

  const toggleRow = useCallback((key: string) => {
    setTicked((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  /**
   * Every ticked cell, across every table, sheet and schedule.
   *
   * The same size ticked on Sch 40 and Sch 80 is two lines, because they are
   * two different products at two different prices.
   */
  const scheduleLines = useMemo<ScheduleLine[]>(() => {
    const lines: ScheduleLine[] = []
    for (const catalogueTable of CATALOGUE) {
      for (const catalogueSheet of catalogueTable.sheets) {
        for (const tableVariant of catalogueTable.variants) {
          for (const row of catalogueSheet.rows) {
            const key = rowKey({
              table: catalogueTable.id,
              sheet: catalogueSheet.id,
              row: row.id,
              variant: tableVariant.id,
            })
            if (!ticked.has(key)) continue
            lines.push({
              key,
              description:
                rowDescription(row) + (tableVariant.label ? `, ${tableVariant.label}` : ''),
              code: row.code ?? null,
              quantity: quantities[key] ?? 1,
              rowPrice: priceBook.resolve(row),
            })
          }
        }
      }
    }
    return lines
  }, [ticked, quantities, priceBook])

  /**
   * Ask periodically whether a newer list exists. Never swap prices under
   * someone mid-quote — offer a reload and let them choose (§9).
   */
  useEffect(() => {
    if (!configured || !loadedAt) return
    let cancelled = false

    const check = async () => {
      const latest = await fetchLatestImportedAt()
      if (!cancelled && latest && latest > loadedAt) setNewListAvailable(true)
    }

    const timer = setInterval(check, FRESHNESS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [configured, loadedAt])

  /** Ticked rows if there are any, else what is on screen — as the old tool did. */
  const gridSelection = useCallback((): { sheet: CatalogueSheet; variant: string; rows: CatalogueRow[] }[] => {
    if (ticked.size === 0) return [{ sheet, variant, rows: visibleRows }]

    const groups: { sheet: CatalogueSheet; variant: string; rows: CatalogueRow[] }[] = []
    for (const catalogueTable of CATALOGUE) {
      for (const catalogueSheet of catalogueTable.sheets) {
        for (const tableVariant of catalogueTable.variants) {
          const rows = catalogueSheet.rows.filter((row) =>
            ticked.has(rowKey({
              table: catalogueTable.id,
              sheet: catalogueSheet.id,
              row: row.id,
              variant: tableVariant.id,
            })),
          )
          if (rows.length > 0) groups.push({ sheet: catalogueSheet, variant: tableVariant.id, rows })
        }
      }
    }
    return groups
  }, [ticked, sheet, variant, visibleRows])

  const copyGrid = useCallback(async () => {
    const blocks: string[] = []
    for (const group of gridSelection()) {
      if (group.rows.length === 0) continue
      const columns = visibleColumns(group.sheet, group.variant)
      const header = [...columns.map((c) => c.label), 'Price', 'Unit']
      const body = group.rows.map((row) => {
        const rowPrice = priceBook.resolve(row)
        return [
          ...columns.map((column) =>
            (column.variant ? row.values[group.variant]?.[column.key] : row.fixed[column.key]) ?? '',
          ),
          // The price column travels with the grid, as in the original tool.
          rowPrice.state === 'poa'
            ? 'P.O.A.'
            : rowPrice.price === null
              ? ''
              : rowPrice.price.toFixed(2),
          rowPrice.unit ?? '',
        ].join('\t')
      })
      blocks.push([group.sheet.name, header.join('\t'), ...body].join('\n'))
    }

    if (blocks.length === 0) return
    await navigator.clipboard.writeText(blocks.join('\n\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [gridSelection, priceBook])

  const staleness = stalenessWarning(priceBook.currentEffectiveFrom)

  return (
    <>
      {!configured && (
        <p className="banner amber">
          The price database is not configured, so every price is blank. Set{' '}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
          Blank is deliberate — a missing price is safer than a stale one.
        </p>
      )}

      {newListAvailable && (
        <p className="banner">
          New price list available —{' '}
          <button className="action" onClick={() => window.location.reload()}>
            reload
          </button>
          . Your ticked rows will be cleared, so finish the quote first if you are mid-way.
        </p>
      )}

      {staleness && <p className="banner amber">{staleness}</p>}

      <div className="tabs no-print" role="tablist">
        {CATALOGUE.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === activeTableId}
            onClick={() => setActiveTableId(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar no-print">
        {table.sheets.length > 1 && (
          <label>
            {table.sheetLabel ?? 'Sheet:'}{' '}
            <select
              value={sheet.id}
              // Scoped to this table only.
              onChange={(e) =>
                setSheetByTable((previous) => ({ ...previous, [table.id]: e.target.value }))
              }
            >
              {table.sheets.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        )}

        {table.variants.length > 1 && (
          <label>
            {table.variantLabel ?? 'Schedule:'}{' '}
            <select
              value={variant}
              onChange={(e) =>
                setVariantByTable((previous) => ({ ...previous, [table.id]: e.target.value }))
              }
            >
              {table.variants.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </label>
        )}

        {table.filter && (
          <input
            type="search"
            placeholder="fitting, size or code"
            value={filter}
            onChange={(e) =>
              setFilterByTable((previous) => ({ ...previous, [table.id]: e.target.value }))
            }
          />
        )}

        <span className="count">
          {visibleRows.length} of {rowsInVariant.length} rows
          {ticked.size > 0 && ` · ${ticked.size} ticked`}
        </span>

        <button className="action" onClick={copyGrid} disabled={visibleRows.length === 0}>
          {copied ? 'Copied' : ticked.size > 0 ? 'Copy ticked to Excel' : 'Copy grid to Excel'}
        </button>
        <button className="action" onClick={() => setTicked(new Set())} disabled={ticked.size === 0}>
          Clear all{ticked.size > 0 ? ` (${ticked.size})` : ''}
        </button>
        <label>
          <input
            type="checkbox"
            checked={showDrawings}
            onChange={(e) => setShowDrawings(e.target.checked)}
          />{' '}
          Drawings
        </label>
        <button className="action" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <div className="print-note">
        {table.name}
        {variantLabel && ` — ${variantLabel}`}
      </div>

      <CatalogueTableView
        table={table}
        sheet={sheet}
        rows={visibleRows}
        variant={variant}
        variantLabel={variantLabel}
        priceBook={priceBook}
        ticked={ticked}
        onToggle={toggleRow}
        showDrawings={showDrawings}
      />

      <p className="source-note">{table.sourceNote}</p>

      <h2 style={{ marginTop: 28, fontSize: 15 }}>Price schedule</h2>
      <PriceSchedule
        lines={scheduleLines}
        onQuantityChange={(key, quantity) =>
          setQuantities((previous) => ({ ...previous, [key]: quantity }))
        }
      />

      {prices.length > 0 && (
        <p className="note" style={{ marginTop: 20 }}>
          {priceBook.size} prices loaded
          {priceBook.currentEffectiveFrom && `, current from ${priceBook.currentEffectiveFrom}`}.
          Unmatched rows show no price rather than a guessed one.
        </p>
      )}
    </>
  )
}
