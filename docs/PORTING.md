# Porting `Piping_15.html`

The old single-file tool is the specification for the new one. Port it; don't
redesign it (§10 of the brief).

Everything except the row data is done: the tabs, the two selector axes, the
columns, the source notes, the scale drawings and the price resolution are all
in place and tested. What is missing is the contents of the `rows: []` arrays in
`src/lib/catalogue/*.ts`, and the seed price list.

**Put `Piping_15.html` in the repository root and the extraction can be
scripted.** It is not in the repo today.

## The two axes

The single most important thing the old file gets right, and the thing a careless
port loses:

| Axis | In the old file | Here |
|---|---|---|
| **Variant** — Sch 40/80, Class 9/12/16, 10S/40S, Medium/Heavy | `data-variants` on the tab; `switchVariant`; columns tagged `class="v" data-v="sch40"` | `CatalogueTable.variants`, `CatalogueColumn.variant`, `CatalogueRow.values[variantId]` |
| **Sheet** — Elbow SR / LR / Caps / Tees, the PVC ranges, the flange types | separate `.sheet` divs; `switchFitting` | `CatalogueTable.sheets` |

They are independent, and **each is scoped to its own table**. A single shared
value is what made switching range on SS Threaded blank the A234 table.

**A variant carries its own tick state.** The same 2" pipe ticked on Sch 40 and
on Sch 80 is two lines on the schedule, because they are two different products
at two different prices. The tick key is
`table:sheet:row:variant` — see `rowKey()`.

**A row is "made" in a variant when the key is present**, not when it holds
anything. Tables with one unnamed variant carry `values: { x: {} }` for every
row and those rows very much exist. A row genuinely not made in a schedule has
the key *absent*: 22" MS pipe is Sch 80 only, 80 mm SANS 62 is Medium only.
`hasVariant()` encodes this; getting it backwards silently disables whole tabs.

## Mapping a `<tr>` to a `CatalogueRow`

```
<tr data-fig="elbow" data-ang="90" data-ctr="76.20" data-ctrlabel="A"
    data-od="60.30" data-title="2&quot; (50 NB)" data-kind="Elbow 90° LR"
    data-vals='{"sch40":{"id":"52.50","t":"3.91","m":"0.70"}, ...}'>
  <td>2"</td><td>50</td><td>60.30</td><td>76.20</td>
  <td class="v" data-v="sch40">52.50</td> ...
```

becomes

```ts
{
  id: 'elbow-lr-90-50',            // stable, unique within the sheet
  kind: 'Elbow 90° LR',            // data-kind
  title: '2" (50 NB)',             // data-title
  fixed: { nps: '2"', dn: '50', od: '60.30', ctr: '76.20' },   // the plain <td>s
  values: JSON.parse(dataVals),    // the data-v cells, verbatim
  drawing: { kind: 'elbow', od: 60.30, centreToEnd: 76.20, angle: 90, centreLabel: 'A' },
}
```

Values stay as **strings**, exactly as printed, so a trailing zero survives.
Reducers and tees carry a pair as `'large,small'` — keep the comma form.

### Drawing spec per `data-fig`

| `data-fig` | `DrawingSpec` |
|---|---|
| `pipe` | `{ kind: 'pipe', od }` |
| `elbow` | `{ kind: 'elbow', od, centreToEnd: data-ctr, angle: data-ang, centreLabel: data-ctrlabel }` |
| `reducer` | `{ kind: 'reducer', od: [large, small], length: data-len, eccentric: data-ecc === '1' }` |
| `cap` | `{ kind: 'cap', od, length: data-len }` |
| `tee` | `{ kind: 'tee', od: [run, branch], a: data-a, b: data-b }` |
| `flange` | `{ kind: 'flange', d, c, rf, bore, t, hub: data-hub === '1', weld: data-weld === '1' }` |
| `pvcfit`, `threaded` | **no `drawing` key at all** — these have no standard geometry |

`data-code` becomes `code`, `data-note` becomes `note`. Flange rows take every
dimension from the row, not from the variant values, which is why they draw
even though `values` is `{ x: {} }`.

## The price list

`DEFAULT_PRICE_LIST` in the old file is 932 entries. Reshape it to the standard
CSV of §5 and save it as `seed/<supplier>-2026-04-15.csv`:

```csv
code,description,unit,price,effective_from
PVCFGO10063,PVC 90° elbow 63 mm,each,64.49,2026-04-15
```

- 655 of the entries carry a `code`; those are the PVC lines and they price by
  code-exact match.
- The rest are Macsteel lines with a description only. Keep them — they are what
  the guarded fuzzy matcher works against.
- Entries with `"price": 0.0` are **not** free. `PVCFTY10125` is a 125 mm 45° tee
  marked "non-stock, on request" and priced 0.00 in the old file. Import it as an
  **empty price** (P.O.A.), not as zero, or it will quote at nothing.
- The four `PVCCON…` tank connectors and `PVCFRC103150160` print `P.O.A` in the
  table and are absent from `DEFAULT_PRICE_LIST`. They must reach the seed with a
  blank price so they resolve to P.O.A. rather than to nothing. That is 5 P.O.A.
  rows, as §15 requires.

**Drop the static price cells from the PVC fittings table.** Prices had two homes
in the old file — the table markup and `DEFAULT_PRICE_LIST` — and that is exactly
the drift this rebuild removes. The Price column is rendered from the price book.

## Order of work

1. **The seed CSV first.** It is self-contained and it unblocks the regression test.
2. **`pvc-fittings` next** — every row has a code, so it exercises the pricing path.
3. **One table at a time** after that, running `npm test` between each.

`tests/regression.test.ts` is dormant until `seed/` has a CSV and the catalogue
has rows; from then on it asserts the numbers the old tool was signed off
against — 1,204 rows, 655 priced, 5 P.O.A., 0 wrong, 0 lost.

## Rules that are not negotiable

Each of these cost real money or real trust in the old file. They are encoded in
tests; don't work around them.

- **Every row that has a supplier code must carry it.** A coded row is priced by
  code alone. This is what stopped a 237B cement taking the 237A rate.
- **A row with no code gets no price** unless the guarded fuzzy matcher is
  confident *and* unambiguous. Blank is the correct answer. Fixing the family
  guard removed 30 wrong matches — carbon end caps and reducers priced off ASA300
  forged flange lines, 6"/10" SS pipe Sch 10S matched to a nipple rate. Those
  rows show blank now and must stay blank.
- **`pipe` is tested last** in the family list, or "Pipe support clip" resolves to
  family `pipe`. Do not sort that array.
- **Sizes come from the supplier code, not the printed size cell** — where the
  code can be read. See the next section.

## What the real codes disproved

The brief describes the code as `PVCF + <2 letters> + <series> + <4-digit groups>`,
with the series fixing the unit. Checked against the actual list, that holds for
the main families but not for all of them, so `extractors/pvc/code.ts` decodes
only what it can prove:

- **Series does not fix the unit on the adaptor families.** `PVCFRC200200375` is
  "20 mm x 3/8"" and `PVCFPO200120250` is "12 mm x 1/4"" — series 2, first group
  millimetres, second inches. Series 3 mixes the same way. The decoder returns
  `label: null` for those rather than a confident wrong size.
- **Three-letter types with no series digit exist**: `PVCFRCF10000750`,
  `PVCFFFF1000`, `PVCFMIL00200500`, `PVCFPSC0040C`.
- **Trailing letters exist**: `PVCFBO10016N`, `PVCFPSC0040C`.
- **Some codes carry no size**: `PVCFPTFE`, `PVCFPTFEHW`.
- **Other prefixes exist**: `GASK…`, `CEME…`, `PPHF…`, `PVCCON…`, `GALVGBR…`.

The extractor still picks all of those up as priced lines — it only skips the
size cross-check when the code cannot be decoded. None of this affects the
catalogue port, where sizes come from `data-title`.

## Known gaps carried from the old work

- The **supplier name** for the 2026-04-15 PVC list is unrecorded — the source
  note says only "supplier price list dated 15-04-2026". Set it at import rather
  than inventing one.
- **VAT basis** is assumed excluding VAT. The T&Cs pages of the source PDF are
  scanned images with no text layer, so it was never confirmed. Record the answer
  in `price_lists.notes`.
- **Not yet extracted**, both in the same source PDF: page 14 galvanised backing
  rings (`GALVGBR…` — real prices *and* full flange geometry: OD, ID, thickness,
  bolt count, PCD, bolt length), and pages 10–13 thermoplastic valves (probably
  belong in the separate valve/instrument tagger).
- The old file also had **draggable tab reordering** and a **jsPDF** price-schedule
  download. Neither is ported. Both are cosmetic next to the shared database, and
  the browser's own "Save as PDF" covers the second.
