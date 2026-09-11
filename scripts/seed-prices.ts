/**
 * Load a seed price list into the database.
 *
 *   npm run seed
 *   npm run seed -- --supplier "Macsteel" --file seed/pvc-2026-04-15.csv
 *
 * Imports through `import_price_list`, the same security-definer function the
 * import screen uses, so the seed arrives by exactly the route a real list
 * does and gets the same price_lists row and the same history. There is no
 * back door here and no service-role key: if this script can do it, the app
 * can do it.
 *
 * Safe to re-run. Nothing is overwritten — each run adds a list, and the newest
 * effective_from wins. That is also how you correct the supplier name later.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseStandardCsv } from '../src/lib/import/csv.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? undefined : process.argv[at + 1]
}

/* Credentials come from the environment, never from the repository. */
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

const seedDir = join(ROOT, 'seed')
const file =
  arg('file') ?? readdirSync(seedDir).filter((f) => f.endsWith('.csv')).sort()[0]
if (!file) {
  console.error('no CSV in seed/ — run `npm run port` first')
  process.exit(1)
}

const path = file.includes('/') ? join(ROOT, file) : join(seedDir, file)
const text = readFileSync(path, 'utf8')

/*
 * The supplier for the 2026-04-15 list was never recorded — the source note
 * says only "supplier price list dated 15-04-2026" — so it is asked for rather
 * than invented. See the "Known gaps" section of docs/PORTING.md.
 */
const supplier = arg('supplier') ?? 'Unrecorded supplier'
const effectiveFrom = arg('from') ?? (file.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '2026-04-15')

const parsed = parseStandardCsv(text, effectiveFrom)
if (parsed.errors.length > 0) {
  console.error(`${parsed.errors.length} line(s) would not parse — nothing imported:`)
  for (const error of parsed.errors.slice(0, 20)) {
    console.error(`  line ${error.line}: ${error.reason}`)
  }
  process.exit(1)
}

const poa = parsed.rows.filter((row) => row.price === null).length
console.log(
  `${path.replace(ROOT + '/', '')}: ${parsed.rows.length} lines (${poa} P.O.A.)\n` +
    `supplier "${supplier}", effective ${effectiveFrom}`,
)

const response = await fetch(`${url}/rest/v1/rpc/import_price_list`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    p_supplier_name: supplier,
    p_effective_from: effectiveFrom,
    p_source_file: file,
    p_notes:
      'Seeded from Piping_15.html DEFAULT_PRICE_LIST ' +
      '("Built-in list (Macsteel + PVC price list 15-04-2026)"). ' +
      'VAT basis unconfirmed — assumed excluding VAT.',
    p_imported_by: 'seed script',
    p_rows: parsed.rows,
  }),
})

if (!response.ok) {
  console.error(`import failed: ${response.status} ${await response.text()}`)
  process.exit(1)
}

console.log(`imported as price list ${await response.text()}`)
