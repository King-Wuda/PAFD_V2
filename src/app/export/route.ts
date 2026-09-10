import { renderOfflineHtml } from '@/lib/export/offline'
import { fetchCurrentPrices } from '@/lib/data'

export const dynamic = 'force-dynamic'

/**
 * The offline copy: catalogue plus current prices as one self-contained HTML
 * file, generated from the database rather than hand-edited (§11).
 */
export async function GET() {
  const prices = await fetchCurrentPrices()
  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(renderOfflineHtml(prices), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="piping-offline-${stamp}.html"`,
      'Cache-Control': 'no-store',
    },
  })
}
