/**
 * Load the seed price lists into the database.
 *
 *   npm run seed                       # every list in seed/manifest.json
 *   npm run seed -- --file pvc-2026-04-15.csv --supplier "Macsteel"
 *
 * Imports through `import_price_list`, the same security-definer function the
 * import screen uses, so a seed arrives by exactly the route a real list does
 * and gets the same price_lists row and the same history. There is no back
 * door here and no service-role key: if this script can do it, the app can.
 *
 * Safe to re-run. Nothing is overwritten — each run adds a list and the newest
 * effective_from wins. Correcting a supplier name is a re-run, not an edit.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseStandardCsv } from '../src/lib/import/csv.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SEED_DIR = join(ROOT, 'seed')

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? undefined : process.argv[at + 1]
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error(
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first\n' +
      '(.env.local is read automatically by `npm run seed`).',
  )
  process.exit(1)
}

interface ListSpec {
  file: string
  supplier: string
  effectiveFrom: string
  notes?: string
}

const manifest: { lists: ListSpec[] } = JSON.parse(
  readFileSync(join(SEED_DIR, 'manifest.json'), 'utf8'),
)

const only = arg('file')
const lists = only
  ? [
      manifest.lists.find((l) => l.file === only) ?? {
        file: only,
        supplier: arg('supplier') ?? 'Unrecorded supplier',
        effectiveFrom: arg('from') ?? '2026-04-15',
      },
    ]
  : manifest.lists

let failed = false

for (const spec of lists) {
  const supplier = arg('supplier') ?? spec.supplier
  const text = readFileSync(join(SEED_DIR, spec.file), 'utf8')
  const parsed = parseStandardCsv(text, spec.effectiveFrom)

  if (parsed.errors.length > 0) {
    console.error(`${spec.file}: ${parsed.errors.length} line(s) would not parse — skipped:`)
    for (const error of parsed.errors.slice(0, 10)) {
      console.error(`  line ${error.line}: ${error.reason}`)
    }
    failed = true
    continue
  }

  const poa = parsed.rows.filter((row) => row.price === null).length
  const response = await fetch(`${url}/rest/v1/rpc/import_price_list`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_supplier_name: supplier,
      p_effective_from: spec.effectiveFrom,
      p_source_file: spec.file,
      p_notes: spec.notes ?? null,
      p_imported_by: 'seed script',
      p_rows: parsed.rows,
    }),
  })

  if (!response.ok) {
    console.error(`${spec.file}: import failed — ${response.status} ${await response.text()}`)
    failed = true
    continue
  }

  console.log(
    `${spec.file}: ${parsed.rows.length} lines (${poa} P.O.A.) ` +
      `as "${supplier}" effective ${spec.effectiveFrom} -> ${(await response.text()).trim()}`,
  )
}

if (failed) process.exit(1)
