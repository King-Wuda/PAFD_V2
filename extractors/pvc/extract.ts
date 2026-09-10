/**
 * PVC fittings extractor.
 *
 *   pdftotext -layout -f 3 -l 9 supplier.pdf pages.txt
 *   node --experimental-strip-types extractors/pvc/extract.ts pages.txt \
 *        --effective 2026-04-15 --out seed/pvc-2026-04-15.csv
 *
 * A developer tool, run locally. It is not part of the app runtime — messy
 * supplier files never reach the database directly (§5). Its only output is
 * the standard CSV.
 *
 * Method: `pdftotext -layout` preserves the column positions, so splitting a
 * line on runs of two or more spaces recovers the cells. For each cell that
 * looks like a supplier code, the cell before it is the printed size and the
 * cell after it is the price.
 *
 * Sizes come from the code, not from the printed size cell — see ./code.ts for
 * why. Disagreements are reported on stderr rather than silently corrected, so
 * the count of bad cells in the source document stays visible.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { decodePvcCode, printedSizeAgrees } from './code.ts'

/**
 * Any supplier code, not just the regular PVCF shape. Three-letter families
 * (PVCFRCF, PVCFMIL, PVCFPSC) and the other prefixes (GASK, CEME, PPHF,
 * PVCCON) are real priced lines and must not be skipped just because
 * decodePvcCode cannot read their size.
 */
const CODE_CELL = /^(?:PVCF[A-Z]{2,3}\d*(?:\d{4})*[A-Z]*|(?:GASK|CEME|PPHF|PVCCON|GALV)[A-Z0-9]+)$/
const PRICE_CELL = /^R?\s*\d[\d\s]*(?:[.,]\d{2})?$/
const POA_CELL = /^(p\.?o\.?a\.?|on\s*application|on\s*request|poa)$/i

interface Extracted {
  code: string
  description: string
  unit: string
  price: number | null
  printedSize: string
  line: number
}

function parsePrice(cell: string): number | null {
  if (cell === '' || POA_CELL.test(cell)) return null
  if (!PRICE_CELL.test(cell)) return null
  const cleaned = cell.replace(/[R\s]/gi, '').replace(',', '.')
  const value = Number(cleaned)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

export function extract(text: string): { rows: Extracted[]; skipped: string[] } {
  const rows: Extracted[] = []
  const skipped: string[] = []

  text.split(/\r?\n/).forEach((line, index) => {
    const cells = line
      .split(/\s{2,}/)
      .map((cell) => cell.trim())
      .filter((cell) => cell !== '')

    cells.forEach((cell, position) => {
      if (!CODE_CELL.test(cell)) return

      const decoded = decodePvcCode(cell)

      const printedSize = cells[position - 1] ?? ''
      const priceCell = cells[position + 1] ?? ''
      const price = parsePrice(priceCell)

      if (price === null && !POA_CELL.test(priceCell) && priceCell !== '') {
        skipped.push(`line ${index + 1}: ${cell} — cell after the code was "${priceCell}"`)
        return
      }

      rows.push({
        code: cell,
        // Built from the code where it decodes, because the code is the
        // trustworthy half. Codes the decoder cannot read keep the printed
        // size, flagged below rather than invented.
        description: decoded?.label
          ? `${decoded.type} ${decoded.label}`
          : `${cell} ${printedSize}`.trim(),
        unit: 'each',
        price,
        printedSize,
        line: index + 1,
      })
    })
  })

  return { rows, skipped }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function main(): void {
  const args = process.argv.slice(2)
  const input = args.find((arg) => !arg.startsWith('--'))
  const effective = args[args.indexOf('--effective') + 1]
  const outIndex = args.indexOf('--out')
  const out = outIndex === -1 ? null : args[outIndex + 1]

  if (!input || !effective || !/^\d{4}-\d{2}-\d{2}$/.test(effective)) {
    console.error('usage: extract.ts <pdftotext-output> --effective YYYY-MM-DD [--out file.csv]')
    process.exit(2)
  }

  const { rows, skipped } = extract(readFileSync(input, 'utf8'))

  const seen = new Set<string>()
  const unique = rows.filter((row) => {
    if (seen.has(row.code)) return false
    seen.add(row.code)
    return true
  })

  const csv = [
    'code,description,unit,price,effective_from',
    ...unique.map((row) =>
      [
        row.code,
        csvCell(row.description),
        row.unit,
        row.price === null ? '' : row.price.toFixed(2),
        effective,
      ].join(','),
    ),
  ].join('\n')

  if (out) writeFileSync(out, `${csv}\n`)
  else process.stdout.write(`${csv}\n`)

  // Everything below goes to stderr so it never contaminates the CSV.
  // Only codes the decoder can read can be cross-checked at all.
  const decodable = unique
    .map((row) => ({ row, decoded: decodePvcCode(row.code) }))
    .filter((entry) => entry.decoded !== null)
  const disagreements = decodable.filter(
    (entry) => !printedSizeAgrees(entry.decoded!, entry.row.printedSize),
  )

  console.error(`extracted ${unique.length} codes (${rows.length - unique.length} duplicates dropped)`)
  console.error(`  ${unique.filter((row) => row.price === null).length} P.O.A.`)
  console.error(`  ${unique.length - decodable.length} codes could not be decoded (size not cross-checked)`)
  console.error(`  ${disagreements.length} printed size cells disagree with the code:`)
  for (const { row, decoded } of disagreements) {
    console.error(
      `    line ${row.line}: ${row.code} decodes to ${decoded!.metric} / ${decoded!.inches},` +
      ` printed "${row.printedSize}"`,
    )
  }
  if (skipped.length > 0) {
    console.error(`  ${skipped.length} codes skipped — no readable price:`)
    for (const note of skipped) console.error(`    ${note}`)
  }
}

if (process.argv[1]?.endsWith('extract.ts')) main()
