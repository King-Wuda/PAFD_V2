import type { CurrentPrice } from './types'

/**
 * Families the fuzzy fallback keys on.
 *
 * ORDER IS LOAD-BEARING. `pipe` is tested LAST, because it is a substring of
 * half the catalogue: "Pipe support clip" is a clip, "Pipe cement" is a cement.
 * Testing `pipe` first resolves both to family `pipe` and prices them off pipe
 * rates. Do not sort this list. (§10)
 */
export const PRICE_FAMILIES = [
  'tee', 'elbow', 'cap', 'reducer', 'bend', 'cross', 'socket', 'union',
  'bush', 'nipple', 'plug', 'adaptor', 'flange', 'ring', 'stub', 'gasket',
  'cement', 'tape', 'clip', 'nut', 'connector', 'cleaner',
  'pipe',
] as const

export type PriceFamily = (typeof PRICE_FAMILIES)[number]

/** Spellings that should resolve to a canonical family. */
const FAMILY_ALIASES: Record<string, PriceFamily> = {
  adapter: 'adaptor',
  bushing: 'bush',
  coupling: 'socket',
  'end cap': 'cap',
}

export function familyOf(description: string): PriceFamily | null {
  const text = description.toLowerCase()
  for (const [alias, family] of Object.entries(FAMILY_ALIASES)) {
    if (text.includes(alias)) return family
  }
  for (const family of PRICE_FAMILIES) {
    if (text.includes(family)) return family
  }
  return null
}

const NOISE = new Set([
  'the', 'and', 'for', 'with', 'x', 'of', 'to', 'mm', 'deg', 'degree',
  'degrees', 'sw', 'bsp', 'pvc', 'each', 'no',
])

export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9./"']+/g, ' ')
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !NOISE.has(t))
}

/**
 * Tokens that carry an identity rather than a description — sizes, grades,
 * part suffixes. Anything with a digit in it.
 *
 * These must match exactly. It is the rule that stops a 237B cement taking the
 * 237A rate: both share every word, and differ only in an identifier token.
 */
function identifiers(tokens: string[]): string[] {
  return tokens.filter((t) => /\d/.test(t))
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let shared = 0
  for (const t of setA) if (setB.has(t)) shared++
  return shared / (setA.size + setB.size - shared)
}

/** Below this, a candidate is not considered a match at all. */
const SCORE_FLOOR = 0.55
/** The best candidate must beat the runner-up by this, or the result is ambiguous. */
const AMBIGUITY_MARGIN = 0.15

/**
 * The guarded fuzzy fallback. Used ONLY for catalogue rows that have no
 * supplier code.
 *
 * Returns null far more often than it returns a match, by design: showing no
 * price is correct, showing a wrong price is not (§10). A candidate must
 * share the row's family, contain every identifier token the row has, clear
 * the score floor, and beat the runner-up by a clear margin.
 */
export function fuzzyMatch(
  description: string,
  candidates: readonly CurrentPrice[],
): CurrentPrice | null {
  const family = familyOf(description)
  if (!family) return null

  const queryTokens = tokenise(description)
  const queryIds = identifiers(queryTokens)

  const scored: { entry: CurrentPrice; score: number }[] = []

  for (const candidate of candidates) {
    if (!candidate.description) continue
    if (familyOf(candidate.description) !== family) continue

    const candidateTokens = tokenise(candidate.description)
    const candidateIds = new Set(identifiers(candidateTokens))

    // Every size / grade / suffix in the row must be present in the candidate.
    if (!queryIds.every((id) => candidateIds.has(id))) continue

    const score = jaccard(queryTokens, candidateTokens)
    if (score >= SCORE_FLOOR) scored.push({ entry: candidate, score })
  }

  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score)

  const [best, runnerUp] = scored
  if (runnerUp && best.score - runnerUp.score < AMBIGUITY_MARGIN) return null

  return best.entry
}
