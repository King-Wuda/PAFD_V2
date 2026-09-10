import { HistoryView } from '@/components/HistoryView'
import { fetchPriceLists, isConfigured } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
  if (!isConfigured) {
    return <p className="banner amber">The price database is not configured.</p>
  }

  const lists = await fetchPriceLists()

  return (
    <>
      <h2>Import history</h2>
      <p className="note">
        Every import is kept. Rolling one back makes the previous list current again and
        deletes nothing.
      </p>
      <HistoryView lists={lists} />
    </>
  )
}
