import type { ParseResult, RowError, StandardRow } from './types'

const REQUIRED_HEADERS = ['code', 'description', 'unit', 'price'] as const
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** RFC4180-ish field splitter: handles quotes, escaped quotes and embedded commas. */
function splitLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      fields.push(field)
      field = ''
    } else {
      field += char
    }
  }
  fields.push(field)
  return fields.map((f) => f.trim())
}

/**
 * Parse the standard CSV of §5.
 *
 * `fallbackEffectiveFrom` is used when the file has no effective_from column —
 * the date the user typed on the import screen.
 *
 * Nothing is skipped quietly: every line that fails lands in `errors` with the
 * raw text and the reason.
 */
export function parseStandardCsv(
  text: string,
  fallbackEffectiveFrom?: string,
): ParseResult {
  const errors: RowError[] = []
  const rows: StandardRow[] = []

  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const headerIndex = lines.findIndex((l) => l.trim() !== '')
  if (headerIndex === -1) {
    return { rows, errors: [{ line: 1, raw: '', reason: 'file is empty' }], effectiveFrom: null }
  }

  const headers = splitLine(lines[headerIndex]).map((h) => h.toLowerCase())
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    return {
      rows,
      errors: [{
        line: headerIndex + 1,
        raw: lines[headerIndex],
        reason: `missing required column(s): ${missing.join(', ')}`,
      }],
      effectiveFrom: null,
    }
  }

  const at = (fields: string[], header: string): string => {
    const index = headers.indexOf(header)
    return index === -1 ? '' : (fields[index] ?? '')
  }

  const seen = new Map<string, number>()
  let effectiveFrom: string | null = null

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i]
    const lineNumber = i + 1
    if (raw.trim() === '') continue

    const fields = splitLine(raw)
    const code = at(fields, 'code').toUpperCase()

    if (code === '') {
      errors.push({ line: lineNumber, raw, reason: 'code is blank' })
      continue
    }
    const firstSeen = seen.get(code)
    if (firstSeen !== undefined) {
      errors.push({
        line: lineNumber,
        raw,
        reason: `duplicate code ${code} (first seen on line ${firstSeen})`,
      })
      continue
    }

    const rawPrice = at(fields, 'price')
    let price: number | null = null
    if (rawPrice !== '') {
      // Tolerate "R 1 234,56" and "1,234.56" from hand-edited files.
      const cleaned = rawPrice
        .replace(/[R\s]/gi, '')
        .replace(/,(?=\d{3}\b)/g, '')
        .replace(',', '.')
      const parsed = Number(cleaned)
      if (!Number.isFinite(parsed)) {
        errors.push({ line: lineNumber, raw, reason: `price "${rawPrice}" is not a number` })
        continue
      }
      if (parsed < 0) {
        errors.push({ line: lineNumber, raw, reason: `price "${rawPrice}" is negative` })
        continue
      }
      price = Math.round(parsed * 100) / 100
    }

    const rowDate = at(fields, 'effective_from')
    if (rowDate !== '') {
      if (!ISO_DATE.test(rowDate)) {
        errors.push({
          line: lineNumber,
          raw,
          reason: `effective_from "${rowDate}" is not an ISO date (YYYY-MM-DD)`,
        })
        continue
      }
      if (effectiveFrom === null) {
        effectiveFrom = rowDate
      } else if (rowDate !== effectiveFrom) {
        errors.push({
          line: lineNumber,
          raw,
          reason: `effective_from "${rowDate}" differs from "${effectiveFrom}" — one date per file`,
        })
        continue
      }
    }

    seen.set(code, lineNumber)
    rows.push({
      code,
      description: at(fields, 'description'),
      unit: at(fields, 'unit'),
      price,
    })
  }

  if (effectiveFrom === null && fallbackEffectiveFrom) {
    effectiveFrom = ISO_DATE.test(fallbackEffectiveFrom) ? fallbackEffectiveFrom : null
  }

  return { rows, errors, effectiveFrom }
}
