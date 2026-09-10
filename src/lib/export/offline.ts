import { CATALOGUE } from '@/lib/catalogue'
import type { CurrentPrice } from '@/lib/prices/types'
import { PriceBook, formatDate, formatPrice } from '@/lib/prices/resolve'
import { FIG_STYLE } from '@/lib/drawings'
import { rowDescription } from '@/lib/catalogue/types'

/**
 * JSON that is safe to drop inside a <script> tag.
 *
 * Supplier descriptions arrive from PDFs and spreadsheets we do not control, so
 * a description containing `</script>` must not be able to close the tag.
 */
export function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/**
 * The offline copy (§11).
 *
 * One HTML file, no network of any kind: prices are resolved here, at export
 * time, and baked in beside the catalogue. It is what goes on a laptop for a
 * plant survey, and the fallback if the web app is down.
 *
 * Prices are stamped with the date they were exported so nobody quotes off a
 * file they downloaded a year ago without noticing.
 */
export function renderOfflineHtml(prices: readonly CurrentPrice[], now = new Date()): string {
  const priceBook = new PriceBook(prices)

  const tables = CATALOGUE.map((table) => ({
    id: table.id,
    label: table.label,
    name: table.name,
    variantLabel: table.variantLabel ?? 'Schedule:',
    variants: table.variants,
    sheetLabel: table.sheetLabel ?? 'Sheet:',
    filter: Boolean(table.filter),
    showPrice: Boolean(table.showPrice),
    sourceNote: table.sourceNote,
    sheets: table.sheets.map((sheet) => ({
      id: sheet.id,
      label: sheet.label,
      name: sheet.name,
      columns: sheet.columns.map((column) => ({
        key: column.key,
        label: column.label,
        group: column.group ?? null,
        variant: column.variant ?? null,
        align: column.align ?? 'center',
      })),
      rows: sheet.rows.map((row) => {
        const rowPrice = priceBook.resolve(row)
        return {
          id: row.id,
          code: row.code ?? '',
          description: rowDescription(row),
          note: row.note ?? '',
          fixed: row.fixed,
          values: row.values,
          // Prices are resolved here, at export time, and baked in beside the
          // geometry. The offline copy makes no network calls of any kind.
          price: formatPrice(rowPrice),
          amount: rowPrice.state === 'poa' ? null : rowPrice.price,
          priceNote: rowPrice.note ?? (rowPrice.state === 'poa' ? 'P.O.A.' : ''),
        }
      }),
    })),
  }))

  const exportedOn = now.toISOString().slice(0, 10)
  const pricesFrom = priceBook.currentEffectiveFrom


  return `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Piping &amp; Fittings — offline copy ${exportedOn}</title>
<style>
*{box-sizing:border-box}
body{margin:0;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#16191d}
header{padding:12px 20px;border-bottom:1px solid #d7dce2}
h1{font-size:16px;margin:0}
main{padding:16px 20px 60px}
.banner{padding:8px 12px;border:1px solid #d9ab3a;background:#fdf3d8;color:#6b4c05;border-radius:4px;margin-bottom:12px}
.tabs{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid #d7dce2}
.tabs button{border:1px solid transparent;border-bottom:none;background:none;padding:7px 12px;cursor:pointer;font:inherit;color:#5c646e;border-radius:4px 4px 0 0}
.tabs button[aria-selected=true]{border-color:#d7dce2;background:#fff;color:#16191d;font-weight:600;margin-bottom:-1px}
.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 0}
.toolbar input,.toolbar select{font:inherit;padding:5px 8px;border:1px solid #d7dce2;border-radius:4px}
.count{color:#5c646e}
button.action{font:inherit;padding:5px 11px;border:1px solid #d7dce2;background:#fff;border-radius:4px;cursor:pointer}
.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:1px solid #d7dce2;padding:4px 8px;text-align:center;white-space:nowrap}
thead th{background:#f6f8fa}
td.lft,th.lft{text-align:left;white-space:normal}
td.mono{font-family:Consolas,Menlo,monospace;font-size:12.5px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tr.ticked{background:#eef4fa}
.note{color:#5c646e;font-size:12px}
.source-note{color:#5c646e;font-size:11.5px;margin-top:8px}
.empty{border:1px dashed #d7dce2;padding:24px;text-align:center;color:#5c646e;border-radius:4px}
figure{margin:0 0 10px;max-width:430px}
figcaption{font-size:12.5px;font-weight:600}
${FIG_STYLE}
@media print{.tabs,.toolbar,.no-print{display:none!important}body{font-size:11px}main{padding:0}}
</style>
</head>
<body>
<header><h1>Piping &amp; Fittings — offline copy</h1></header>
<main>
<p class="banner">
  Offline copy exported ${exportedOn}${pricesFrom ? `, prices effective ${formatDate(pricesFrom)}` : ', no prices loaded'}.
  It will not update. Check against the web app before quoting.
</p>
<div class="tabs" id="tabs"></div>
<div class="toolbar">
  <span id="selectors"></span>
  <span class="count" id="count"></span>
  <button class="action" id="copy">Copy to Excel</button>
  <button class="action" id="clear">Clear ticks</button>
  <button class="action" onclick="window.print()">Print</button>
</div>
<div id="printNote" class="no-print" hidden></div>
<div class="scroll" id="grid"></div>
<p class="source-note" id="sourceNote"></p>
<h2 style="font-size:15px;margin-top:28px">Price schedule</h2>
<div id="schedule"></div>
</main>
<script>
const TABLES = ${embedJson(tables)};
const ticked = new Set();
const sheetBy = {}, variantBy = {}, filterBy = {};
let activeId = TABLES.length ? TABLES[0].id : null;

const el = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const table = () => TABLES.find((t) => t.id === activeId);
const sheetOf = (t) => t.sheets.find((s) => s.id === sheetBy[t.id]) || t.sheets[0];
const variantOf = (t) => variantBy[t.id] || t.variants[0].id;
const key = (t, s, r, v) => t + ':' + s + ':' + r + ':' + v;

// Presence of the key is the test: single-variant tables carry an empty map.
const made = (row, v) => Object.prototype.hasOwnProperty.call(row.values, v);
const cols = (sheet, v) => sheet.columns.filter((c) => !c.variant || c.variant === v);
const cell = (row, col, v) => (col.variant ? (row.values[v] || {})[col.key] : row.fixed[col.key]);

function rowsFor(t) {
  const s = sheetOf(t), v = variantOf(t);
  const needle = (filterBy[t.id] || '').toLowerCase().split(/\\s+/).filter(Boolean);
  return s.rows.filter((r) => made(r, v)).filter((r) => {
    if (!needle.length) return true;
    const hay = [r.code, r.description, r.note].concat(Object.values(r.fixed))
      .concat(Object.values(r.values[v] || {})).join(' ').toLowerCase();
    return needle.every((n) => hay.indexOf(n) > -1);
  });
}

function renderTabs() {
  el('tabs').innerHTML = TABLES.map((t) =>
    '<button role="tab" aria-selected="' + (t.id === activeId) + '" data-id="' + t.id + '">' + esc(t.label) + '</button>'
  ).join('');
  el('tabs').querySelectorAll('button').forEach((b) => {
    b.onclick = () => { activeId = b.dataset.id; render(); };
  });
}

function renderSelectors() {
  const t = table();
  if (!t) { el('selectors').innerHTML = ''; return; }
  let html = '';
  if (t.sheets.length > 1) {
    html += esc(t.sheetLabel) + ' <select id="sheetSel">' + t.sheets.map((s) =>
      '<option value="' + s.id + '"' + (s.id === sheetOf(t).id ? ' selected' : '') + '>' + esc(s.label) + '</option>'
    ).join('') + '</select> ';
  }
  if (t.variants.length > 1) {
    html += esc(t.variantLabel) + ' <select id="variantSel">' + t.variants.map((v) =>
      '<option value="' + v.id + '"' + (v.id === variantOf(t) ? ' selected' : '') + '>' + esc(v.label) + '</option>'
    ).join('') + '</select> ';
  }
  if (t.filter) {
    html += '<input type="search" id="filterBox" placeholder="fitting, size or code" value="' + esc(filterBy[t.id] || '') + '">';
  }
  el('selectors').innerHTML = html;
  // Both selectors are scoped to this tab, so switching one cannot blank another.
  const sheetSel = el('sheetSel');
  if (sheetSel) sheetSel.onchange = (e) => { sheetBy[t.id] = e.target.value; render(); };
  const variantSel = el('variantSel');
  if (variantSel) variantSel.onchange = (e) => { variantBy[t.id] = e.target.value; render(); };
  const filterBox = el('filterBox');
  if (filterBox) filterBox.oninput = (e) => { filterBy[t.id] = e.target.value; render(); };
}

function renderGrid() {
  const t = table();
  if (!t) { el('grid').innerHTML = ''; return; }
  const s = sheetOf(t), v = variantOf(t), rows = rowsFor(t);
  el('sourceNote').textContent = t.sourceNote;

  if (!rows.length) {
    el('grid').innerHTML = '<p class="empty">' +
      (s.rows.length ? 'No rows match this filter.' : 'This sheet has not been ported yet.') + '</p>';
    return;
  }

  const columns = cols(s, v);
  const segs = [];
  columns.forEach((c) => {
    const last = segs[segs.length - 1];
    if (c.group && last && last.group === c.group) last.columns.push(c);
    else segs.push({ group: c.group, columns: [c] });
  });
  const two = segs.some((x) => x.group);
  const span = two ? ' rowspan="2"' : '';

  let head = '<tr><th class="no-print"' + span + '></th>';
  segs.forEach((seg) => {
    if (seg.group) head += '<th colspan="' + seg.columns.length + '">' + esc(seg.group) + '</th>';
    else seg.columns.forEach((c) => { head += '<th' + span + '>' + esc(c.label) + '</th>'; });
  });
  if (t.showPrice) head += '<th class="num"' + span + '>Price</th>';
  head += '</tr>';
  if (two) {
    head += '<tr>' + segs.filter((x) => x.group)
      .map((seg) => seg.columns.map((c) => '<th>' + esc(c.label) + '</th>').join('')).join('') + '</tr>';
  }

  const body = rows.map((r) => {
    const k = key(t.id, s.id, r.id, v);
    return '<tr class="' + (ticked.has(k) ? 'ticked' : '') + '">' +
      '<td class="no-print"><input type="checkbox" data-key="' + k + '"' + (ticked.has(k) ? ' checked' : '') + '></td>' +
      columns.map((c) => {
        const cls = (c.align === 'left' ? 'lft' : c.align === 'right' ? 'num' : '') + (c.key === 'code' ? ' mono' : '');
        const value = cell(r, c, v);
        return '<td class="' + cls.trim() + '">' + esc(value == null ? '-' : value) + '</td>';
      }).join('') +
      (t.showPrice ? '<td class="num" title="' + esc(r.priceNote) + '">' + esc(r.price) + '</td>' : '') +
      '</tr>';
  }).join('');

  el('grid').innerHTML = '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  el('grid').querySelectorAll('input[type=checkbox]').forEach((box) => {
    box.onchange = () => {
      if (box.checked) ticked.add(box.dataset.key); else ticked.delete(box.dataset.key);
      render();
    };
  });
}

function tickedGroups() {
  const groups = [];
  TABLES.forEach((t) => t.sheets.forEach((s) => t.variants.forEach((v) => {
    const rows = s.rows.filter((r) => ticked.has(key(t.id, s.id, r.id, v.id)));
    if (rows.length) groups.push({ table: t, sheet: s, variant: v, rows: rows });
  })));
  return groups;
}

function renderSchedule() {
  const groups = tickedGroups();
  if (!groups.length) {
    el('schedule').innerHTML = '<p class="empty">Tick rows to build a price schedule.</p>';
    return;
  }
  let total = 0, excluded = 0, body = '';
  groups.forEach((g) => g.rows.forEach((r) => {
    if (typeof r.amount === 'number') total += r.amount; else excluded++;
    body += '<tr><td class="mono">' + esc(r.code) + '</td><td class="lft">' + esc(r.description) +
      (g.variant.label ? ', ' + esc(g.variant.label) : '') +
      '</td><td class="num">1</td><td class="num">' + esc(r.price) +
      '</td><td class="lft note">' + esc(r.priceNote) + '</td></tr>';
  }));
  el('schedule').innerHTML =
    '<div class="scroll"><table><thead><tr><th>Code</th><th class="lft">Description</th>' +
    '<th class="num">Qty</th><th class="num">Rate</th><th class="lft">Note</th></tr></thead><tbody>' + body +
    '</tbody><tfoot><tr><th colspan="3" style="text-align:right">Total</th>' +
    '<th class="num">R ' + total.toFixed(2) + '</th><th></th></tr></tfoot></table></div>' +
    (excluded ? '<p class="banner">' + excluded + ' line(s) have no usable price and are excluded from the total.</p>' : '');
}

function render() {
  renderTabs(); renderSelectors(); renderGrid(); renderSchedule();
  const t = table();
  const shown = t ? rowsFor(t).length : 0;
  el('count').textContent = shown + ' rows' + (ticked.size ? ' \\u00b7 ' + ticked.size + ' ticked' : '');
  el('printNote').textContent = t ? t.name : '';
}

el('clear').onclick = () => { ticked.clear(); render(); };
el('copy').onclick = () => {
  const t = table();
  if (!t) return;
  const groups = ticked.size
    ? tickedGroups()
    : [{ table: t, sheet: sheetOf(t), variant: { id: variantOf(t), label: '' }, rows: rowsFor(t) }];
  const blocks = groups.map((g) => {
    const columns = cols(g.sheet, g.variant.id);
    const header = columns.map((c) => c.label).concat(['Price']).join('\\t');
    const lines = g.rows.map((r) =>
      columns.map((c) => { const value = cell(r, c, g.variant.id); return value == null ? '' : value; })
        .concat([r.price]).join('\\t'));
    return [g.sheet.name, header].concat(lines).join('\\n');
  });
  navigator.clipboard.writeText(blocks.join('\\n\\n'));
};

render();
</script>
</body>
</html>`
}
