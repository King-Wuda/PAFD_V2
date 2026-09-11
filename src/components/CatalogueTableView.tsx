'use client'

import type {
  CatalogueColumn, CatalogueRow, CatalogueSheet, CatalogueTable,
} from '@/lib/catalogue/types'
import { hasVariant, rowKey } from '@/lib/catalogue/types'
import { figureForRow } from '@/lib/drawings'
import { formatPrice, type PriceBook } from '@/lib/prices/resolve'

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

/** The old file's cell classes, so the printed sheet lines up as before. */
function cellClass(column: CatalogueColumn): string | undefined {
  if (column.key === 'note') return 'lft sm'
  const parts = [
    column.align === 'left' ? 'lft' : '',
    column.align === 'right' ? 'num' : '',
    column.mono ? 'mono' : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : undefined
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
  previewKey,
  onPreview,
}: {
  table: CatalogueTable
  sheet: CatalogueSheet
  rows: CatalogueRow[]
  variant: string
  variantLabel?: string
  priceBook: PriceBook
  ticked: ReadonlySet<string>
  onToggle: (key: string) => void
  previewKey: string | null
  onPreview: (key: string | null) => void
}) {
  if (rows.length === 0) {
    return <p className="empty">No rows match this filter.</p>
  }

  const columns = visibleColumns(sheet, variant)
  const parts = segments(columns)
  const twoRowHeader = parts.some((part) => part.group)

  /*
   * The old file put Price between the code and the note, not at the end of
   * the row. Keep that: people read across to the price and stop there.
   */
  const noteAt = columns.findIndex((column) => column.key === 'note')
  const priceAt = table.showPrice ? (noteAt === -1 ? columns.length : noteAt) : -1

  const span = columns.length + (priceAt === -1 ? 0 : 1) + 1

  const priceHeader = (
    <th key="price" className="num" rowSpan={twoRowHeader ? 2 : 1}>
      Price
    </th>
  )

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {parts.flatMap((part, index) => {
              const before = columns.indexOf(part.columns[0])
              const cells = []
              if (priceAt === before) cells.push(priceHeader)
              cells.push(
                part.group ? (
                  <th key={`g${index}`} colSpan={part.columns.length}>
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
              )
              return cells
            })}
            {priceAt === columns.length && priceHeader}
            <th className="col-select" rowSpan={twoRowHeader ? 2 : 1}>
              Select
            </th>
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
          {rows.flatMap((row) => {
            const key = rowKey({ table: table.id, sheet: sheet.id, row: row.id, variant })
            const isTicked = ticked.has(key)
            const made = hasVariant(row, variant)
            const rowPrice = priceBook.resolve(row)
            const figure = figureForRow(row, variant, variantLabel)
            const isPreviewed = previewKey === key

            const priceCell =
              priceAt === -1 ? null : (
                <td
                  key="price"
                  className={`num ${
                    rowPrice.state === 'poa'
                      ? 'price-poa'
                      : rowPrice.state === 'stale'
                        ? 'price-stale'
                        : ''
                  }`.trim()}
                  title={rowPrice.note ?? undefined}
                >
                  {formatPrice(rowPrice)}
                </td>
              )

            const out = [
              <tr
                key={row.id}
                className={[isTicked ? 'selected' : '', isPreviewed ? 'active-row' : '']
                  .filter(Boolean)
                  .join(' ') || undefined}
                data-fig={figure ? '1' : undefined}
                onClick={() => onPreview(isPreviewed ? null : key)}
              >
                {columns.flatMap((column, index) => {
                  const value = column.variant
                    ? row.values[variant]?.[column.key]
                    : row.fixed[column.key]
                  const cells = []
                  if (priceAt === index && priceCell) cells.push(priceCell)
                  cells.push(
                    <td
                      key={`${column.variant ?? ''}${column.key}`}
                      className={cellClass(column)}
                    >
                      {value ?? '-'}
                    </td>,
                  )
                  return cells
                })}
                {priceAt === columns.length && priceCell}
                {/*
                  Ticking must not open the preview: in the old file the box
                  only adds the size to the list. stopPropagation keeps the two
                  gestures apart.
                */}
                <td className="col-select" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="row-check"
                    checked={isTicked}
                    disabled={!made}
                    onChange={() => onToggle(key)}
                    aria-label={`Select ${row.kind ?? ''} ${row.title}`.trim()}
                  />
                </td>
              </tr>,
            ]

            if (isPreviewed) {
              out.push(
                <tr className="preview-row" key={`${row.id}-preview`}>
                  <td colSpan={span}>
                    <div className="preview-wrap">
                      {figure ? (
                        <figure className="preview-fig">
                          <h4>{figure.caption}</h4>
                          <p className="spec">{figure.spec}</p>
                          {/*
                            The SVG is generated from this row's own catalogue
                            numbers — nothing user-supplied reaches it — so the
                            same generator can serve screen, print and export.
                          */}
                          <div dangerouslySetInnerHTML={{ __html: figure.svg }} />
                        </figure>
                      ) : (
                        <p className="no-fig">
                          {`${row.kind ?? ''} ${row.title}`.trim()}
                          {row.code ? ` — code ${row.code}` : ''} — no dimensional drawing for
                          this type.
                        </p>
                      )}
                    </div>
                    <div className="preview-foot">
                      <span>{sheet.name}</span>
                      <button
                        type="button"
                        className="preview-close"
                        onClick={(event) => {
                          event.stopPropagation()
                          onPreview(null)
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </td>
                </tr>,
              )
            }

            return out
          })}
        </tbody>
      </table>
    </div>
  )
}
