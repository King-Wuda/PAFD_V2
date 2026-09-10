'use client'

import type {
  CatalogueColumn, CatalogueRow, CatalogueSheet, CatalogueTable,
} from '@/lib/catalogue/types'
import { hasVariant, rowKey } from '@/lib/catalogue/types'
import { formatPrice, type PriceBook } from '@/lib/prices/resolve'
import { RowDrawing } from './RowDrawing'

/** Columns shown for the selected variant: the shared ones plus that variant's. */
export function visibleColumns(
  sheet: CatalogueSheet,
  variant: string,
): CatalogueColumn[] {
  return sheet.columns.filter((column) => !column.variant || column.variant === variant)
}

interface HeaderSegment {
  group?: string
  columns: CatalogueColumn[]
}

/** Group consecutive columns that share a spanning heading, as the old file did. */
function segments(columns: CatalogueColumn[]): HeaderSegment[] {
  const out: HeaderSegment[] = []
  for (const column of columns) {
    const last = out[out.length - 1]
    if (column.group && last && last.group === column.group) last.columns.push(column)
    else out.push({ group: column.group, columns: [column] })
  }
  return out
}

export function CatalogueTableView({
  table,
  sheet,
  rows,
  variant,
  variantLabel,
  priceBook,
  ticked,
  onToggle,
  showDrawings,
}: {
  table: CatalogueTable
  sheet: CatalogueSheet
  rows: CatalogueRow[]
  variant: string
  variantLabel?: string
  priceBook: PriceBook
  ticked: ReadonlySet<string>
  onToggle: (key: string) => void
  showDrawings: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="empty">
        {sheet.rows.length === 0
          ? 'This sheet has not been ported from Piping_15.html yet.'
          : 'No rows match this filter.'}
      </p>
    )
  }

  const columns = visibleColumns(sheet, variant)
  const parts = segments(columns)
  const twoRowHeader = parts.some((part) => part.group)

  return (
    <div className="table-scroll">
      <table className="catalogue">
        <thead>
          <tr>
            <th className="no-print" rowSpan={twoRowHeader ? 2 : 1} />
            {parts.map((part, index) =>
              part.group ? (
                <th key={`g${index}`} colSpan={part.columns.length} className="group">
                  {part.group}
                </th>
              ) : (
                part.columns.map((column) => (
                  <th
                    key={column.key}
                    rowSpan={twoRowHeader ? 2 : 1}
                    className={column.align === 'right' ? 'num' : undefined}
                  >
                    {column.label}
                  </th>
                ))
              ),
            )}
            {table.showPrice && (
              <th className="num" rowSpan={twoRowHeader ? 2 : 1}>
                Price
              </th>
            )}
          </tr>
          {twoRowHeader && (
            <tr className="sch-header">
              {parts
                .filter((part) => part.group)
                .flatMap((part) =>
                  part.columns.map((column) => (
                    <th key={`${part.group}-${column.key}`}>{column.label}</th>
                  )),
                )}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey({ table: table.id, sheet: sheet.id, row: row.id, variant })
            const isTicked = ticked.has(key)
            const made = hasVariant(row, variant)
            const rowPrice = priceBook.resolve(row)

            return (
              <tr key={row.id} className={isTicked ? 'ticked' : undefined}>
                <td className="no-print">
                  {/*
                    A row that is not made in this schedule cannot be ticked.
                    The old file printed '-' across its cells; it must not be
                    possible to put it on a quote.
                  */}
                  <input
                    type="checkbox"
                    checked={isTicked}
                    disabled={!made}
                    onChange={() => onToggle(key)}
                    aria-label={`Select ${row.kind ?? ''} ${row.title}`.trim()}
                  />
                </td>
                {columns.map((column) => {
                  const value = column.variant
                    ? row.values[variant]?.[column.key]
                    : row.fixed[column.key]
                  return (
                    <td
                      key={`${column.variant ?? ''}${column.key}`}
                      className={[
                        column.align === 'right' ? 'num' : '',
                        column.mono ? 'mono' : '',
                        column.key === 'note' ? 'note' : '',
                      ].filter(Boolean).join(' ') || undefined}
                      style={column.align === 'left' ? { whiteSpace: 'normal' } : undefined}
                    >
                      {value ?? '-'}
                      {showDrawings && column.key === (columns[0]?.key ?? '') && (
                        <RowDrawing row={row} variant={variant} variantLabel={variantLabel} />
                      )}
                    </td>
                  )
                })}
                {table.showPrice && (
                  <td
                    className={`num ${
                      rowPrice.state === 'poa'
                        ? 'price-poa'
                        : rowPrice.state === 'stale'
                          ? 'price-stale'
                          : ''
                    }`}
                    title={rowPrice.note ?? undefined}
                  >
                    {formatPrice(rowPrice)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
