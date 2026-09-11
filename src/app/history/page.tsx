import { HistoryView } from '@/components/HistoryView'
import { SubPageHead } from '@/components/PageHead'
import { fetchPriceLists, isConfigured } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
  if (!isConfigured) {
    return (
      <>
        <SubPageHead title="Import history" />
        <p className="banner amber">The price database is not configured.</p>
      </>
    )
  }

  const lists = await fetchPriceLists()

  return (
    <>
      <SubPageHead
        title="Import history"
        meta="Every import is kept. Rolling one back makes the previous list current again and deletes nothing."
      />
      <HistoryView lists={lists} />
    </>
  )
}
