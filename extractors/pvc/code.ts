/**
 * Decoding the PVC supplier's codes.
 *
 * The regular shape is:
 *
 *   PVCF + <2-letter fitting type> + <1-digit series> + <repeating 4-digit groups>
 *
 *   series 1  solvent weld, metric        groups are millimetres
 *   series 2  BSP threaded                groups are inches x 1000 (0375 = 3/8")
 *   series 3  adaptor, plain x BSP        groups are mixed, see below
 *   series 4  back nut                    groups are inches x 1000
 *
 * WHAT THE REAL CODE LIST SHOWS, beyond that rule — all confirmed against
 * Piping_15.html, and the reason this decoder refuses more than it accepts:
 *
 *   - Series does NOT determine the unit on the adaptor families. PVCFRC200200375
 *     is "20 mm x 3/8"" and PVCFPO200120250 is "12 mm x 1/4"": series 2, but the
 *     first group is millimetres and the second is inches. Series 3 is mixed the
 *     same way (PVCFAF300160375 = 16 mm x 3/8").
 *   - Some families have a three-letter type and no series digit at all:
 *     PVCFRCF10000750, PVCFFFF1000, PVCFMIL00200500, PVCFPSC0040C.
 *   - Some codes carry a trailing letter: PVCFBO10016N, PVCFPSC0040C.
 *   - Some carry no size at all: PVCFPTFE, PVCFPTFEHW.
 *   - Other families do not use the PVCF prefix: GASKQR10020, CEMETAN0050,
 *     PPHFCON0500B, PVCCON007500903000.
 *
 * So this decodes the regular shape and returns null for everything else. A
 * code it cannot read is not an error — it just means the size cross-check is
 * skipped for that line, which is the safe outcome.
 */

export type Series = 1 | 2 | 3 | 4

export interface DecodedCode {
  code: string
  /** Two-letter fitting type, e.g. 'GO', 'TR'. */
  type: string
  series: Series
  /** The raw 4-digit groups, in order. */
  groups: number[]
  /** Trailing letters after the size, e.g. the 'N' on PVCFBO10016N. */
  suffix: string
  /** Groups read as millimetres, e.g. '63 x 50mm'. */
  metric: string
  /** Groups read as inches, e.g. '1.1/4 x 1"'. */
  inches: string
  /**
   * The reading the series implies, where the series is a reliable guide.
   * Null on series 2 and 3, whose adaptor families mix millimetres and inches
   * within one code — see the note above.
   */
  label: string | null
}

const CODE_PATTERN = /^PVCF([A-Z]{2})([1-4])((?:\d{4})+)([A-Z]*)$/

/** 375 -> '3/8', 1250 -> '1.1/4', 2000 -> '2'. */
export function inchesFromThousandths(thousandths: number): string {
  const whole = Math.floor(thousandths / 1000)
  const remainder = thousandths % 1000
  if (remainder === 0) return String(whole)

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(remainder, 1000)
  const fraction = `${remainder / divisor}/${1000 / divisor}`

  return whole === 0 ? fraction : `${whole}.${fraction}`
}

export function decodePvcCode(rawCode: string): DecodedCode | null {
  const code = rawCode.trim().toUpperCase()
  const match = CODE_PATTERN.exec(code)
  if (!match) return null

  const [, type, seriesDigit, sizeDigits, suffix] = match
  const series = Number(seriesDigit) as Series

  const groups: number[] = []
  for (let i = 0; i < sizeDigits.length; i += 4) {
    groups.push(Number(sizeDigits.slice(i, i + 4)))
  }

  const metric = `${groups.join(' x ')}mm`
  const inches = `${groups.map(inchesFromThousandths).join(' x ')}"`

  return {
    code,
    type,
    series,
    groups,
    suffix,
    metric,
    inches,
    // Series 2 and 3 mix units within one code on the adaptor families, so no
    // single reading can be claimed. Better to say nothing than to say wrong.
    label: series === 1 ? metric : series === 4 ? inches : null,
  }
}

/**
 * Does the printed size cell agree with the code?
 *
 * Accepts either reading, because a code cannot always tell you which one the
 * supplier printed. Used to report — not silently correct — the errors in the
 * source document, so a human can see how many there were.
 */
export function printedSizeAgrees(decoded: DecodedCode, printed: string): boolean {
  const numbers = (printed.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  if (numbers.length === 0) return false

  const asMetric = decoded.groups.every((group) => numbers.includes(group))
  // '1.1/4' reads as the numbers 1, 1 and 4, so compare on the rendered text.
  const printedCompact = printed.replace(/\s+/g, '')
  const asInches = decoded.groups.every((group) =>
    printedCompact.includes(inchesFromThousandths(group)),
  )
  return asMetric || asInches
}
