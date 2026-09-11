/**
 * Liveness probe for the host's health check.
 *
 * Deliberately touches nothing. Pointing the check at `/` instead would re-run
 * the whole price fetch every few seconds — about 130 KB a time, for an answer
 * nobody reads — and spend the database's bandwidth allowance on it.
 *
 * This reports that the process is up and serving, which is the only question
 * a restart can answer. Whether the database is reachable is a different
 * question with a different remedy, and the catalogue is designed to render
 * without it.
 */

export const dynamic = 'force-dynamic'

export function GET() {
  return new Response('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
  })
}
