import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * The browser-facing key.
 *
 * Supabase issues these as `sb_publishable_...` now; older projects call the
 * same thing the anon key. Both are read-only in this app's hands — writes go
 * through the two security-definer functions — so either name is accepted and
 * nothing downstream cares which one was set.
 *
 * Both branches are written out in full because Next.js inlines
 * `process.env.NEXT_PUBLIC_*` at build time by literal substitution; a
 * computed lookup would come back undefined in the browser.
 */
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * True when the app has been pointed at a Supabase project.
 *
 * The app runs without one — the catalogue renders and every price cell is
 * blank. That is the correct degraded state: no prices is right, invented
 * prices are not.
 */
export const isConfigured = Boolean(url && publishableKey)

let cached: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!isConfigured) return null
  if (!cached) {
    cached = createClient(url!, publishableKey!, { auth: { persistSession: false } })
  }
  return cached
}

/** The same key, for the direct `fetch` to the chat-import edge function. */
export { publishableKey }
