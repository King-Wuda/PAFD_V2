import type { CatalogueRow } from '@/lib/catalogue/types'

/**
 * Structured matching for the supplier lines that carry no code.
 *
 * The guarded word-overlap matcher in match.ts refuses all 277 Macsteel lines,
 * and it is right to: "8\" MS pipe (200 NB)" and "PIPE SEAMLESS ASTM A106
 * GRADE B 200 x SCH40 6.000Mtr ASTRON APPROVED" share almost no words, and the
 * row's own description does not even say which schedule is wanted.
 *
 * But the lines are not prose. They are a supplier's own template, and both
 * sides carry the same three facts — what it is, what size, and which variant.
 * So this reads those three fields off each side and matches on them exactly,
 * which is a different and far safer thing than scoring words.
 *
 * Nothing here guesses. A description that does not fit a known template
 * returns null and the line stays unmatched, because a pipe priced off the
 * wrong template is worse than a pipe with no price.
 */
export interface Spec {
  /** What it is: 'pipe-ms', 'elbow-ss-90', 'thr-nipple', 'flange-so'. */
  family: string
  /** DN in mm. A reducing item carries both, large first: '100x50'. */
  size: string
  /** The variant that fixes the price: 'SCH40', 'MED', 'BARREL', '4.5', ''. */
  qualifier: string
}

export function specKey(spec: Spec): string {
  return `${spec.family}|${spec.size}|${spec.qualifier}`
}

/** '42.40' -> '42.4', so '6.0' and '6' are the same wall. */
function normNumber(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value.trim()
}

/** '32 x 15' -> '32x15'. */
function normSize(dn: string): string {
  return dn.split(/\s*[x\/]\s*/).map((p) => p.trim()).filter(Boolean).join('x')
}

/* ------------------------------------------------------------------ *
 * The catalogue side
 * ------------------------------------------------------------------ */

const SS_SCHEDULE: Record<string, string> = { ss10: 'SCH10', ss40: 'SCH40' }
const MS_SCHEDULE: Record<string, string> = { sch40: 'SCH40', sch80: 'SCH80' }
const SANS62_CLASS: Record<string, string> = { med: 'MED', hvy: 'HVY' }

export function specOfRow(
  tableId: string,
  sheetId: string,
  row: CatalogueRow,
  variantId: string,
): Spec | null {
  const dn = row.fixed.dn
  if (!dn) return null
  const size = normSize(dn)

  switch (tableId) {
    case 'ms-pipe': {
      const qualifier = MS_SCHEDULE[variantId]
      return qualifier ? { family: 'pipe-ms', size, qualifier } : null
    }
    case 'sans62-pipe': {
      const qualifier = SANS62_CLASS[variantId]
      return qualifier ? { family: 'pipe-sans62', size, qualifier } : null
    }
    case 'sans719-pipe': {
      // These rows share a DN and differ only by wall, so the wall is the
      // qualifier: 200 NB comes in 3.5, 4.5 and 6.0 at three prices.
      const wall = row.values[variantId]?.t
      const grade = (row.fixed.grade ?? '').toLowerCase().includes('a') ? 'a' : 'b'
      return wall ? { family: `pipe-sans719-${grade}`, size, qualifier: normNumber(wall) } : null
    }
    case 'ss-fittings': {
      const qualifier = SS_SCHEDULE[variantId]
      if (!qualifier) return null
      if (sheetId === 'ss-elbow-90') return { family: 'elbow-ss-90', size, qualifier }
      if (sheetId === 'ss-tee') return { family: 'tee-ss', size, qualifier }
      if (sheetId === 'ss-reducer') return { family: 'reducer-ss', size, qualifier }
      return null
    }
    case 'ss-threaded': {
      const base = sheetId.replace(/^thr-/, '')
      const pattern = (row.fixed.pattern ?? '').toUpperCase()
      // The catalogue prints an em dash where there is no pattern.
      const qualifier = pattern === '—' || pattern === '-' ? '' : pattern
      return { family: `thr-${base}`, size, qualifier }
    }
    case 'asa300-flanges': {
      const kind = sheetId.replace(/^flange-/, '')
      return { family: `flange-${kind}`, size, qualifier: '' }
    }
    default:
      // ss-pipe, the A234 carbon fittings and the PVC tables have no
      // description-only counterpart in this supplier's list. They are priced
      // by code or not at all.
      return null
  }
}

/* ------------------------------------------------------------------ *
 * The supplier side
 * ------------------------------------------------------------------ */

interface Template {
  test: RegExp
  spec: (m: RegExpMatchArray) => Spec
}

/**
 * The supplier's own line templates, read off their list.
 *
 * Order matters only in that the first match wins; the templates are
 * disjoint by their leading word.
 */
const TEMPLATES: Template[] = [
  {
    // PIPE SEAMLESS ASTM A106 GRADE B 200 x SCH40 6.000Mtr ASTRON APPROVED
    test: /^PIPE SEAMLESS .*GRADE B (\d+) X SCH([A-Z0-9]+)\b/,
    spec: (m) => ({ family: 'pipe-ms', size: m[1], qualifier: `SCH${m[2]}` }),
  },
  {
    // PIPE UNCOATED PLAIN ENDED CQ HR SANS62 100 x MED 6.000Mtr SCARFED
    test: /^PIPE UNCOATED .*SANS ?62 (\d+) X (MED|HVY)\b/,
    spec: (m) => ({ family: 'pipe-sans62', size: m[1], qualifier: m[2] }),
  },
  {
    // PIPE UNCOATED PLAIN ENDED SANS 719 GRADE B 250 x 4.5 6.100Mtr
    test: /^PIPE UNCOATED .*SANS ?719 GRADE ([AB]) (\d+) X ([\d.]+)/,
    spec: (m) => ({
      family: `pipe-sans719-${m[1].toLowerCase()}`,
      size: m[2],
      qualifier: normNumber(m[3]),
    }),
  },
  {
    // ELBOW GRADE 304 L 100 x 90 LR x SCH10 — and the 316 L equivalents.
    // The grade is deliberately NOT part of the family: one catalogue table
    // covers 304L and 316L, so both grades fit the same row and the person
    // quoting picks. Putting the grade in the key would match neither.
    test: /^ELBOW GRADE (?:304|316) L (\d+) X (\d+) LR X SCH(\d+)/,
    spec: (m) => ({ family: `elbow-ss-${m[2]}`, size: m[1], qualifier: `SCH${m[3]}` }),
  },
  {
    // TEE EQUAL GRADE 304 L 100 x SCH10 — grade excluded, as for the elbow.
    test: /^TEE EQUAL GRADE (?:304|316) L (\d+) X SCH(\d+)/,
    spec: (m) => ({ family: 'tee-ss', size: m[1], qualifier: `SCH${m[2]}` }),
  },
  {
    // REDUCER CONCENTRIC GRADE 304 L 100 x 50 x SCH10 — grade excluded.
    test: /^REDUCER CONCENTRIC GRADE (?:304|316) L (\d+) X (\d+) X SCH(\d+)/,
    spec: (m) => ({ family: 'reducer-ss', size: `${m[1]}x${m[2]}`, qualifier: `SCH${m[3]}` }),
  },
  {
    // BUSH REDUCING SS316 BSP THREADED 150LB 15 x 10
    test: /^BUSH REDUCING SS\d+ BSP THREADED \d+LB (\d+) X (\d+)/,
    spec: (m) => ({ family: 'thr-bush', size: `${m[1]}x${m[2]}`, qualifier: '' }),
  },
  {
    // ELBOW SS316 BSP THREADED 150LB 15 x 90 x FF
    test: /^ELBOW SS\d+ BSP THREADED \d+LB (\d+) X \d+ X ([A-Z]+)/,
    spec: (m) => ({ family: 'thr-elbow', size: m[1], qualifier: m[2] }),
  },
  {
    // SOCKET SS316 BSP THREADED 150LB 15
    test: /^SOCKET SS\d+ BSP THREADED \d+LB (\d+)\s*$/,
    spec: (m) => ({ family: 'thr-socket', size: m[1], qualifier: '' }),
  },
  {
    // NIPPLE / PLUG / UNION / TEE EQUAL, each with a pattern word
    test: /^(NIPPLE|PLUG|UNION|TEE EQUAL) SS\d+ BSP THREADED \d+LB (\d+) X ([A-Z]+)/,
    spec: (m) => ({
      family: `thr-${m[1] === 'TEE EQUAL' ? 'tee' : m[1].toLowerCase()}`,
      size: m[2],
      qualifier: m[3],
    }),
  },
  {
    // FORGED FLANGE ASTM/ASME A/SA 105 ASA300 x RF x WN40 x 100
    test: /^FORGED FLANGE .*ASA300 X RF X (BLD|SO|WN\d+) X (\d+)/,
    spec: (m) => ({ family: `flange-${m[1].toLowerCase()}`, size: m[2], qualifier: '' }),
  },
]

export function specOfPriceLine(description: string): Spec | null {
  const text = description.toUpperCase().replace(/\s+/g, ' ').trim()
  for (const template of TEMPLATES) {
    const m = text.match(template.test)
    if (m) return template.spec(m)
  }
  return null
}

/**
 * Order several lines that fit the same row, best default first.
 *
 * Macsteel lists the same 200 NB Sch 40 pipe as Astron approved at R1560.26 and
 * Sasol approved at R1285.59. Nothing in the catalogue says which the job needs,
 * so something has to be picked, and the two mistakes are not equal: quoting the
 * dearer one when the cheaper would do loses a job, quoting the cheaper one when
 * the job needs the dearer loses money on a job already won.
 *
 * So the default is the **dearest** line that fits. It is flagged in the
 * schedule and the rest are one dropdown away, which makes the safe answer the
 * one you correct downward on purpose rather than the one you discover later.
 */
export function compareCandidates(
  a: { description: string | null; price: number | null },
  b: { description: string | null; price: number | null },
): number {
  // A P.O.A. line prices nothing, so it never displaces one that does.
  if ((a.price === null) !== (b.price === null)) return a.price === null ? 1 : -1
  const byPrice = (b.price ?? 0) - (a.price ?? 0)
  if (byPrice !== 0) return byPrice
  return (a.description ?? '').localeCompare(b.description ?? '')
}
