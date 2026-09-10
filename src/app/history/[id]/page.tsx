import Link from 'next/link'
import { DiffReview } from '@/components/DiffReview'
import { diffPriceList } from '@/lib/import/diff'
import { fetchListPrices, fetchPriceLists, isConfigured } from '@/lib/data'
import type { StandardRow } from '@/lib/import/types'

export const dynamic = 'force-dynamic'

/**
 * What one import changed, against the supplier's previous list.
 *
 * Reconstructed from stored rows rather than saved at import time, so it stays
 * correct if an intervening import is rolled back.
 */
export default async function ImportDiffPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!isConfigured) {
    return <p className="banner amber">The price database is not configured.</p>
  }

  const { id } = await params
  const lists = await fetchPriceLists()
  const list = lists.find((entry) => entry.id === id)

  if (!list) return <p className="empty">No such import.</p>

  const previous = lists
    .filter(
      (entry) =>
        entry.supplierId === list.supplierId &&
        (entry.effectiveFrom < list.effectiveFrom ||
          (entry.effectiveFrom === list.effectiveFrom && entry.importedAt < list.importedAt)),
    )
    .sort((a, b) =>
      a.effectiveFrom === b.effectiveFrom
        ? b.importedAt.localeCompare(a.importedAt)
        : b.effectiveFrom.localeCompare(a.effectiveFrom),
    )[0]

  const [rows, before] = await Promise.all([
    fetchListPrices(list.id),
    previous ? fetchListPrices(previous.id) : Promise.resolve([]),
  ])

  const incoming: StandardRow[] = rows.map((row) => ({
    code: row.code,
    description: row.description ?? '',
    unit: '',
    price: row.price,
  }))

  return (
    <>
      <p>
        <Link href="/history">← History</Link>
      </p>
      <h2>
        {list.supplierName} · effective {list.effectiveFrom}
      </h2>
      <p className="note">
        {list.rowCount} rows, imported by {list.importedBy ?? 'someone'}
        {list.sourceFile && ` from ${list.sourceFile}`}
        {list.superseded && ' · rolled back'}
        {previous
          ? ` · compared against the list effective ${previous.effectiveFrom}`
          : ' · first list from this supplier, so every code is new'}
      </p>

      <DiffReview diff={diffPriceList(incoming, before)} />
    </>
  )
}
