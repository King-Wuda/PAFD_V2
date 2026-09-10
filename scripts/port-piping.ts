/**
 * Port the row data out of Piping_15.html.
 *
 *   node --experimental-strip-types scripts/port-piping.ts Piping_15.html
 *
 * Writes one generated module per table into src/lib/catalogue/rows/, and the
 * seed price list into seed/. Those files are machine-written — edit the old
 * HTML and re-run this, never edit the output by hand.
 *
 * The old file is the specification (§10). This script ports it; it does not
 * interpret it. Where it cannot read something it stops and says so, because a
 * silently dropped row is a lost quote line and a silently invented one is a
 * wrong price.
 *
 * The two axes it must preserve — see docs/PORTING.md:
 *
 *   values[variant]  present  = the row IS made in that schedule, even if the
 *                              map is empty (PVC fittings carry {x:{}})
 *                    absent   = not made; the old file printed '-'
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATALOGUE } from '../src/lib/catalogue/index.ts'
import type { CatalogueRow, CatalogueSheet, DrawingSpec } from '../src/lib/catalogue/types.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const source = process.argv[2] ?? join(ROOT, 'Piping_15.html')
const html = readFileSync(source, 'utf8')

/* ------------------------------------------------------------------ *
 * Small HTML helpers. The old file is machine-generated markup with
 * consistent quoting, so a scan is enough and pulls in no dependency.
 * ------------------------------------------------------------------ */

function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&minus;/g, '−')
    .replace(/&deg;/g, '°')
    .replace(/&oslash;/g, 'ø')
    .replace(/&nbsp;/g, ' ')
    .replace(/Â°/g, '°')   // mojibake for ° in the source file
    .replace(/â€”/g, '—')
    .trim()
}

/** Attributes of one tag, e.g. `<tr data-fig="pipe" ...>`. */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag))) out[m[1]] = m[2] ?? m[3] ?? ''
  return out
}

/** Every `<tr …>…</tr>` inside the first `<tbody>` of a chunk of markup. */
function tableRows(sheetHtml: string): string[] {
  const start = sheetHtml.indexOf('<tbody>')
  const end = sheetHtml.indexOf('</tbody>', start)
  if (start === -1 || end === -1) return []
  const body = sheetHtml.slice(start + 7, end)
  return body.split('<tr ').slice(1).map((r) => '<tr ' + r)
}

/** The `<td>`s of a row, as [attributes, text]. */
function cells(rowHtml: string): Array<{ attr: Record<string, string>; text: string }> {
  const out: Array<{ attr: Record<string, string>; text: string }> = []
  const re = /<td([^>]*)>([\s\S]*?)<\/td>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rowHtml))) {
    out.push({ attr: attrs('<td' + m[1] + '>'), text: decode(m[2].replace(/<[^>]*>/g, '')) })
  }
  return out
}

/** The markup of one `<div id="…">`, up to the start of the next same-level id. */
function block(source_: string, id: string, nextIds: string[]): string {
  const open = source_.indexOf(`id="${id}"`)
  if (open === -1) throw new Error(`no <div id="${id}"> in the source file`)
  let end = source_.length
  for (const next of nextIds) {
    const at = source_.indexOf(`id="${next}"`, open)
    if (at > -1 && at < end) end = at
  }
  return source_.slice(open, end)
}

/* ------------------------------------------------------------------ *
 * Row extraction
 * ------------------------------------------------------------------ */

const num = (v: string | undefined) => (v === undefined ? NaN : Number(v))
const pair = (v: string | undefined): [number, number] => {
  const [a, b] = String(v ?? '').split(',').map(Number)
  return [a, b]
}

function drawingOf(a: Record<string, string>): DrawingSpec | undefined {
  switch (a['data-fig']) {
    case 'pipe':
      return { kind: 'pipe', od: num(a['data-od']) }
    case 'elbow':
      return {
        kind: 'elbow',
        od: num(a['data-od']),
        centreToEnd: num(a['data-ctr']),
        angle: num(a['data-ang']) === 45 ? 45 : 90,
        centreLabel: a['data-ctrlabel'] ?? 'A',
      }
    case 'reducer':
      return {
        kind: 'reducer',
        od: pair(a['data-od']),
        length: num(a['data-len']),
        eccentric: a['data-ecc'] === '1',
      }
    case 'cap':
      return { kind: 'cap', od: num(a['data-od']), length: num(a['data-len']) }
    case 'tee':
      return { kind: 'tee', od: pair(a['data-od']), a: num(a['data-a']), b: num(a['data-b']) }
    case 'flange':
      return {
        kind: 'flange',
        d: num(a['data-d']),
        c: num(a['data-c']),
        rf: num(a['data-rf']),
        bore: num(a['data-bore']),
        t: num(a['data-t']),
        hub: a['data-hub'] === '1',
        weld: a['data-weld'] === '1',
      }
    default:
      // 'pvcfit' and 'threaded' have no standard face-to-face geometry, so the
      // old file drew nothing for them. Neither do we.
      return undefined
  }
}

/** Stable, unique-within-sheet id. */
function makeId(row: { code?: string; kind?: string; title: string }, taken: Set<string>): string {
  const base = (row.code ?? `${row.kind ?? ''} ${row.title}`)
    .toLowerCase()
    .replace(/[°"']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'row'
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  taken.add(id)
  return id
}

const problems: string[] = []

function extractSheet(
  sheetHtml: string,
  sheet: CatalogueSheet,
  where: string,
  showPrice: boolean,
): CatalogueRow[] {
  const taken = new Set<string>()

  return tableRows(sheetHtml).map((rowHtml, i) => {
    const openTag = rowHtml.slice(0, rowHtml.indexOf('>') + 1)
    const a = attrs(openTag)

    let values: Record<string, Record<string, string>> = {}
    try {
      values = JSON.parse(decode(a['data-vals'] ?? '{}'))
    } catch {
      problems.push(`${where} row ${i + 1}: data-vals is not valid JSON`)
    }

    // Walk columns and cells together. The old file emits one <td> per column
    // — hidden variant cells included — so a length mismatch means the port
    // has drifted from the source and must not be guessed at.
    let tds = cells(rowHtml).filter((c) => !(c.attr.class ?? '').includes('col-select'))

    // The old file froze a price cell into the PVC fittings table. Here the
    // price is looked up live from the database on the supplier code, so the
    // catalogue has no price column and that cell is dropped rather than
    // ported — a price baked into geometry is a price nobody can update.
    if (showPrice) tds = tds.filter((c) => !(c.attr.class ?? '').split(/\s+/).includes('num'))
    if (tds.length !== sheet.columns.length) {
      problems.push(
        `${where} row ${i + 1} ("${decode(a['data-title'] ?? '?')}"): ` +
          `${tds.length} cells but ${sheet.columns.length} columns`,
      )
    }

    const fixed: Record<string, string> = {}
    sheet.columns.forEach((column, c) => {
      if (column.variant) return          // those come from data-vals
      const cell = tds[c]
      if (cell) fixed[column.key] = cell.text
    })

    const row: CatalogueRow = {
      id: '',
      title: decode(a['data-title'] ?? ''),
      fixed,
      values,
    }
    const kind = decode(a['data-kind'] ?? '')
    if (kind) row.kind = kind
    const code = decode(a['data-code'] ?? '')
    if (code) row.code = code
    const note = decode(a['data-note'] ?? '')
    if (note) row.note = note
    const drawing = drawingOf(a)
    if (drawing) row.drawing = drawing

    row.id = makeId(row, taken)
    return row
  })
}

/* ------------------------------------------------------------------ *
 * Walk the catalogue and pull each sheet out of the old file.
 * ------------------------------------------------------------------ */

/** Catalogue table id -> the tab div id in the old file. */
const TAB_OF: Record<string, string> = {
  'ms-pipe': 'ms-tab',
  'ss-pipe': 'ss-tab',
  'pvc-pipe': 'pvc-tab',
  'pvc-fittings': 'pvc-fittings-tab',
  'a234-fittings': 'fittings-tab',
  'ss-fittings': 'ss-fittings-tab',
  'ss-threaded': 'ss-threaded-tab',
  'sans62-pipe': 'sans62-tab',
  'sans719-pipe': 'sans719-tab',
  'asa300-flanges': 'flange-tab',
}

/** Every coded row in the catalogue, so the seed can be checked against it. */
const codedRows = new Map<string, CatalogueRow>()

const tabIds = Object.values(TAB_OF)
const outDir = join(ROOT, 'src/lib/catalogue/rows')
mkdirSync(outDir, { recursive: true })

let total = 0

for (const table of CATALOGUE) {
  const tabId = TAB_OF[table.id]
  const tabHtml = block(html, tabId, tabIds.filter((t) => t !== tabId).concat('prices-view'))

  const sheetIds = table.sheets.map((s) => s.id)
  const bySheet: Record<string, CatalogueRow[]> = {}

  for (const sheet of table.sheets) {
    const sheetHtml = block(tabHtml, sheet.id, sheetIds.filter((s) => s !== sheet.id))
    const rows = extractSheet(
      sheetHtml, sheet, `${table.id}/${sheet.id}`, table.showPrice === true,
    )
    bySheet[sheet.id] = rows
    for (const row of rows) if (row.code) codedRows.set(row.code.toUpperCase(), row)
    total += rows.length
    console.log(`  ${table.id}/${sheet.id}: ${rows.length} rows`)
  }

  const file = join(outDir, `${table.id}.ts`)
  writeFileSync(
    file,
    '// GENERATED by scripts/port-piping.ts from Piping_15.html. Do not edit.\n' +
      "import type { CatalogueRow } from '../types'\n\n" +
      `export const ROWS: Record<string, CatalogueRow[]> = ${JSON.stringify(bySheet, null, 2)}\n`,
  )
}

/* ------------------------------------------------------------------ *
 * The seed price list, out of DEFAULT_PRICE_LIST.
 *
 * Three things happen here that the old file did not do, all of them recorded
 * in docs/PORTING.md:
 *
 *  1. A 0.00 is written as an empty price, not as zero. The old table printed
 *     "R 0.00" for PVCFTY10125, a 125 mm tee its own note calls "non-stock, on
 *     request". Quoting a non-stock item at nothing is a real invoice; P.O.A.
 *     is the honest answer. This is the one deliberate departure from the §15
 *     tally, and tests/regression.test.ts says so where it counts.
 *
 *  2. The five rows that print "P.O.A" in the table but are absent from
 *     DEFAULT_PRICE_LIST are added with an empty price, so they resolve to
 *     P.O.A. rather than to nothing at all.
 *
 *  3. The 277 description-only Macsteel lines cannot go in. `prices.code` is
 *     `not null` and the standard CSV of §5 requires a code, so there is no
 *     key to store them under. They priced nothing in the signed-off tool
 *     either — the family guard rejects every one of them, which is what the
 *     655 in §15 measures — so no price is lost by leaving them out. They are
 *     written to seed/reference/ verbatim rather than dropped, because the day
 *     someone gets codes from Macsteel that file is the head start.
 * ------------------------------------------------------------------ */

const listStart = html.indexOf('const DEFAULT_PRICE_LIST = [')
if (listStart === -1) {
  problems.push('DEFAULT_PRICE_LIST not found in the source file')
} else {
  const open = html.indexOf('[', listStart)
  const close = html.indexOf('];', open)
  const entries: Array<{ desc: string; unit: string; price: number; code?: string }> = JSON.parse(
    html.slice(open, close + 1),
  )

  const csvField = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const seen = new Set<string>()
  const lines = ['code,description,unit,price']
  const uncoded = ['description,unit,price']
  let poa = 0

  for (const e of entries) {
    const code = (e.code ?? '').toUpperCase().trim()
    if (!code) {
      uncoded.push([csvField(decode(e.desc)), csvField(e.unit || 'each'), e.price.toFixed(2)].join(','))
      continue
    }
    if (seen.has(code)) {
      problems.push(`DEFAULT_PRICE_LIST carries ${code} twice`)
      continue
    }
    seen.add(code)
    const price = e.price > 0 ? e.price.toFixed(2) : ''
    if (price === '') poa++
    lines.push([code, csvField(decode(e.desc)), csvField(e.unit || 'each'), price].join(','))
  }

  // The P.O.A. rows the price list never carried. Their description comes from
  // the catalogue row itself, so it reads the same way as every other line.
  let added = 0
  for (const [code, row] of codedRows) {
    if (seen.has(code)) continue
    const desc = `${row.kind ? `${row.kind} ` : ''}${row.title} ${code}`
    lines.push([code, csvField(desc), 'each', ''].join(','))
    seen.add(code)
    poa++
    added++
  }

  // Every coded catalogue row must now have a line, or a row prices to nothing
  // for a reason nobody will find later.
  for (const code of codedRows.keys()) {
    if (!seen.has(code)) problems.push(`catalogue code ${code} has no seed line`)
  }

  mkdirSync(join(ROOT, 'seed', 'reference'), { recursive: true })
  writeFileSync(join(ROOT, 'seed', 'pvc-2026-04-15.csv'), lines.join('\n') + '\n')
  writeFileSync(
    join(ROOT, 'seed', 'reference', 'macsteel-2026-04-15-uncoded.csv'),
    uncoded.join('\n') + '\n',
  )

  console.log(
    `\nseed/pvc-2026-04-15.csv: ${lines.length - 1} lines ` +
      `(${poa} P.O.A., ${added} added from the catalogue)\n` +
      `seed/reference/macsteel-2026-04-15-uncoded.csv: ${uncoded.length - 1} lines, ` +
      `no supplier code — reference only, not importable`,
  )
}

console.log(`\n${total} catalogue rows written to src/lib/catalogue/rows/`)

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems.slice(0, 40)) console.error('  ' + p)
  if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`)
  process.exit(1)
}
