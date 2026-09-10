/**
 * Let Node resolve the app's extensionless TypeScript imports.
 *
 * The source uses `from './ms-pipe'`, which Next and tsc resolve but Node's
 * ESM loader does not. This hook appends `.ts` (or `/index.ts`) when the bare
 * specifier does not exist, so a developer script can import the real
 * catalogue rather than a copy of it that could drift.
 */

import { register } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export async function resolve(specifier, context, next) {
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
