'use client'

import type { CatalogueRow } from '@/lib/catalogue/types'
import { figureForRow } from '@/lib/drawings'

/**
 * A scale drawing for one row at one variant.
 *
 * The SVG is generated from the row's own catalogue numbers — no external
 * input reaches it — so rendering it as markup is safe and lets the same
 * generator serve the screen, the print sheet and the offline export.
 */
export function RowDrawing({
  row,
  variant,
  variantLabel,
}: {
  row: CatalogueRow
  variant: string
  variantLabel?: string
}) {
  const figure = figureForRow(row, variant, variantLabel)
  if (!figure) return null

  return (
    <figure className="print-block" style={{ margin: '0 0 10px', maxWidth: 430 }}>
      <figcaption style={{ fontSize: 12.5, fontWeight: 600 }}>{figure.caption}</figcaption>
      <p className="note" style={{ margin: '0 0 2px' }}>{figure.spec}</p>
      <div className="drawing" dangerouslySetInnerHTML={{ __html: figure.svg }} />
    </figure>
  )
}
