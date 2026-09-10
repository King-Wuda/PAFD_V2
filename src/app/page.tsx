import { Dashboard } from '@/components/Dashboard'
import { fetchCurrentPrices, fetchLatestImportedAt, isConfigured } from '@/lib/data'

// Prices are shared and change on import; never serve a cached page.
export const dynamic = 'force-dynamic'

export default async function CataloguePage() {
  const [prices, loadedAt] = await Promise.all([
    fetchCurrentPrices(),
    fetchLatestImportedAt(),
  ])

  return <Dashboard prices={prices} configured={isConfigured} loadedAt={loadedAt} />
}
