/**
 * Let Node resolve the app's extensionless TypeScript imports.
 *
 * The source uses `from './ms-pipe'` and `from '@/lib/prices/types'`, which
 * Next and tsc resolve but Node's ESM loader does not. This hook maps the `@/`
 * alias onto src/ and appends `.ts` (or `/index.ts`) when the bare specifier
 * does not exist, so a developer script can import the real catalogue and the
 * real price book rather than copies of them that could drift.
 */

import { register } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

export async function resolve(specifier, context, next) {
  // '@/lib/prices/types' -> <repo>/src/lib/prices/types, per tsconfig paths.
  if (specifier.startsWith('@/')) {
    const base = pathToFileURL(join(SRC, specifier.slice(2))).href
    // The file forms come first: '@/lib/catalogue' is both a directory and a
    // module, and Node cannot import the directory.
    for (const candidate of [`${base}.ts`, `${base}/index.ts`, `${base}.tsx`, base]) {
      const path = fileURLToPath(candidate)
      if (existsSync(path) && statSync(path).isFile()) return next(candidate, context)
    }
  }

  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const base = new URL(specifier, context.parentURL)
    for (const candidate of [`${base.href}.ts`, `${base.href}/index.ts`]) {
      if (existsSync(fileURLToPath(candidate))) {
        return next(candidate, context)
      }
    }
  }
  return next(specifier, context)
}

register(pathToFileURL(import.meta.filename))
