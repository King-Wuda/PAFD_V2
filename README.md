# PAFD — Piping & Fittings Dashboard

Pipe and fitting sizing for mechanical engineers, with one shared price
database instead of a copy of an HTML file on everyone's PC.

Geometry — sizes, schedules, standards, drawings — is baked into the app as
typed constants, because it does not change. **Prices are the only thing in the
database.** When someone imports a new supplier list, everyone sees it.

## State of play

| Build step (brief §13) | Status |
|---|---|
| 1. Schema, `current_prices` view, seed | Schema and view done and tested. **Seed blocked** — see below. |
| 2. Read-only app, prices by code | Done. Catalogue structure ported; row data pending. |
| 3. All tabs, filter, ticking, copy grid, print, price schedule | Done. |
| 4. CSV import: parse → diff → confirm → write | Done. |
| 5. History and rollback | Done. |
| 6. Chat import via edge function | Done, unverified against the live API. |
| 7. Freshness banners | Done. |
| 8. Offline HTML export | Done. |

**Blocked on one file.** `Piping_15.html` is not in this repository. Its
structure has been ported — the ten tabs, both selector axes, every column and
source note, and the scale drawings — but the ~1,204 rows and the 932-entry
price list still need extracting from it. Drop the file in the repo root and the
rest is scripted. See [docs/PORTING.md](docs/PORTING.md).

## Running it

```bash
npm install
cp .env.example .env.local     # fill in the Supabase URL and anon key
npm run dev
```

Without Supabase credentials the app still runs: the catalogue renders and every
price is blank, with a banner saying why. That is the intended degraded state —
a missing price is safe, a stale or guessed one is not.

## Setting up the database

```bash
supabase db push                      # applies supabase/migrations/0001_init.sql
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy chat-import
```

There is no auth, by decision: the data is not confidential and this is an
internal work tool. Writes are gated by a confirmation dialogue in the UI, and
by the database itself — `anon` has no insert, update or delete policy, so the
only way in is the two `security definer` functions. `price_lists` and `prices`
are append-only; a bad import is retired with `superseded = true`, never
deleted.

## Tests

```bash
npm test          # 92 unit tests
npm run test:db   # schema, resolution and rollback, against a real Postgres
```

`npm run test:db` starts a throwaway Postgres in Docker, applies the migration
and runs `supabase/tests/resolution.test.sql`. It asserts that a code missing
from a new list keeps its old price and is flagged, that P.O.A. stays NULL, that
rollback restores the previous price, and that rollback deletes nothing.

`tests/regression.test.ts` reproduces the sign-off the old tool was measured
against — 1,204 rows, 655 priced, 5 P.O.A., 0 wrong, 0 lost, plus known-good
spot values. It is dormant until the port lands, and reports why.

## Layout

```
src/lib/catalogue/   geometry constants, one module per table   (rows pending)
src/lib/drawings/    scale drawings, ported from the old file
src/lib/prices/      code-exact resolution, the guarded fuzzy fallback
src/lib/import/      standard CSV, the diff engine, the xlsx reader
src/lib/export/      the single-file offline copy
src/components/      dashboard, import wizard, diff review, history
supabase/            migrations, the chat-import edge function, SQL tests
extractors/pvc/      developer tool: supplier PDF → standard CSV
```

## Open items

Carried from the brief, not blockers:

- The supplier name for the 2026-04-15 PVC list is unrecorded.
- VAT basis is assumed excluding VAT; the source PDF's T&Cs are scanned images.
- Page 14 galvanised backing rings and pages 10–13 valves are not imported.
- Whether GEA IT has a position on Supabase hosting company data.
- Whether the app should be reachable from site and from home, or internal only.
- Whether quotes need saving. Currently print-and-go.
