/**
 * Dimensioned scale drawings, ported from Piping_15.html.
 *
 * Each figure is drawn to scale from the row's own dimensions and lettered with
 * the values for the selected variant, so a drawing can never disagree with the
 * table beside it.
 *
 * These emit SVG markup as a string. That is deliberate: the same generator has
 * to serve the on-screen preview, the print sheet and the offline HTML export,
 * and only numbers from the catalogue constants ever reach it.
 */

export const FIG_W = 380
export const FIG_H = 268

const FIG_DEFS =
  '<defs>' +
  '<marker id="fa" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L9,3 L0,6 Z" fill="#1e293b"/></marker>' +
  '<marker id="fb" markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto"><path d="M9,0 L0,3 L9,6 Z" fill="#1e293b"/></marker>' +
  '</defs>'

export function num(value: number, decimals = 2): string {
  return Number(value).toFixed(decimals)
}

function dimH(x1: number, x2: number, y: number, label: string): string {
  return (
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="dim" marker-start="url(#fb)" marker-end="url(#fa)"/>` +
    `<text x="${(x1 + x2) / 2}" y="${y - 6}" class="dtx" text-anchor="middle">${label}</text>`
  )
}

function dimV(
  y1: number, y2: number, x: number, label: string,
  side: 'left' | 'right', dy = 0,
): string {
  const anchor = side === 'right' ? 'start' : 'end'
  const tx = side === 'right' ? x + 6 : x - 6
  return (
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="dim" marker-start="url(#fb)" marker-end="url(#fa)"/>` +
    `<text x="${tx}" y="${(y1 + y2) / 2 + 4 + dy}" class="dtx" text-anchor="${anchor}">${label}</text>`
  )
}

function ext(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext"/>`
}

function lead(
  x: number, y: number, tx: number, ty: number, label: string,
  anchor: 'start' | 'end',
): string {
  return (
    `<line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" class="lead"/>` +
    `<circle cx="${x}" cy="${y}" r="1.8" fill="#1e293b"/>` +
    `<text x="${tx + (anchor === 'end' ? -4 : 4)}" y="${ty + 4}" class="dtx" text-anchor="${anchor}">${label}</text>`
  )
}

function centreLine(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="cl"/>`
}

interface Box { x0: number; y0: number; x1: number; y1: number }

/** Fit a millimetre bounding box into the drawing area; returns mm -> px mappers. */
function fitter(box: Box, padL: number, padR: number, padT: number, padB: number) {
  const bw = Math.max(box.x1 - box.x0, 0.001)
  const bh = Math.max(box.y1 - box.y0, 0.001)
  const s = Math.min((FIG_W - padL - padR) / bw, (FIG_H - padT - padB) / bh)
  const ox = padL + ((FIG_W - padL - padR) - bw * s) / 2 - box.x0 * s
  const oy = padT + ((FIG_H - padT - padB) - bh * s) / 2 - box.y0 * s
  return {
    s,
    X: (x: number) => ox + x * s,
    Y: (y: number) => oy + y * s,
  }
}

function svgWrap(body: string): string {
  return (
    `<svg viewBox="0 0 ${FIG_W} ${FIG_H}" xmlns="http://www.w3.org/2000/svg" class="figsvg">` +
    FIG_DEFS + body + '</svg>'
  )
}

/* ---- 90 / 45 degree elbow ---- */

export function figElbow(d: {
  od: number; id: number; t: number; centreToEnd: number
  angle: number; centreLabel: string
}): string {
  const { od, id, centreToEnd: ctr, angle: ang } = d
  const half = (ang / 2) * Math.PI / 180
  const R = ctr / Math.tan(half)
  const th1 = -Math.PI / 2
  const th2 = -Math.PI / 2 + ang * Math.PI / 180
  const Cx = -ctr
  const Cy = R
  const P = (r: number, th: number): [number, number] =>
    [Cx + r * Math.cos(th), Cy + r * Math.sin(th)]
  const ro = R + od / 2, ri = R - od / 2, bo = R + id / 2, bi = R - id / 2

  let x0 = 0, y0 = 0, x1 = 0, y1 = 0, first = true
  for (const r of [ro, ri]) {
    for (let k = 0; k <= 32; k++) {
      const p = P(r, th1 + (th2 - th1) * k / 32)
      if (first) { x0 = x1 = p[0]; y0 = y1 = p[1]; first = false }
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0])
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1])
    }
  }

  const f = fitter({ x0, y0, x1, y1 }, 78, 62, 74, 44)
  const A = (r: number, th: number) => {
    const p = P(r, th)
    return `${f.X(p[0])} ${f.Y(p[1])}`
  }
  const rp = (r: number) => r * f.s

  const ring = (outer: number, inner: number) =>
    `M${A(outer, th1)} A${rp(outer)} ${rp(outer)} 0 0 1 ${A(outer, th2)}` +
    ` L${A(inner, th2)} A${rp(inner)} ${rp(inner)} 0 0 0 ${A(inner, th1)} Z`

  let s = ''
  s += `<path d="${ring(ro, ri)} ${ring(bo, bi)}" class="wall" fill-rule="evenodd"/>`
  s += centreLine(f.X(-ctr) - 22, f.Y(0), f.X(0) + 18, f.Y(0))
  if (ang === 90) s += centreLine(f.X(0), f.Y(0) - 18, f.X(0), f.Y(ctr) + 22)
  s += `<path d="M${A(R, th1)} A${rp(R)} ${rp(R)} 0 0 1 ${A(R, th2)}" class="cl" fill="none"/>`

  const fx = f.X(-ctr)
  s += ext(fx, f.Y(-od / 2), fx - 34, f.Y(-od / 2)) + ext(fx, f.Y(od / 2), fx - 34, f.Y(od / 2))
  s += dimV(f.Y(-od / 2), f.Y(od / 2), fx - 26, `OD ${num(od, 1)}`, 'left')
  s += dimV(f.Y(-id / 2), f.Y(id / 2), fx + 18, `ID ${num(id)}`, 'right', -9)
  s += lead(fx + 2, f.Y(-(od + id) / 4), fx + 40, f.Y(-od / 2) - 26, `t ${num(d.t)}`, 'start')

  const ay = f.Y(-od / 2) - 40
  s += ext(fx, f.Y(-od / 2) - 4, fx, ay - 4) + ext(f.X(0), f.Y(0), f.X(0), ay - 4)
  s += dimH(fx, f.X(0), ay, `${d.centreLabel} ${num(ctr, 1)}`)

  if (ang === 90) {
    const bx = f.X(od / 2) + 34
    s += ext(f.X(od / 2), f.Y(0), bx + 4, f.Y(0)) + ext(f.X(od / 2), f.Y(ctr), bx + 4, f.Y(ctr))
    s += dimV(f.Y(0), f.Y(ctr), bx, `${d.centreLabel} ${num(ctr, 1)}`, 'right')
  } else {
    s += `<text x="${f.X(0) + 6}" y="${f.Y(0) + 18}" class="dtx">${ang}°</text>`
  }
  return svgWrap(s)
}

/* ---- concentric / eccentric reducer ---- */

export function figReducer(d: {
  length: number
  od1: number; od2: number; id1: number; id2: number; t1: number; t2: number
  eccentric: boolean
}): string {
  const { length: L, od1, od2, id1, id2 } = d
  // The small end is shifted on an eccentric reducer so one side runs flat.
  const off = d.eccentric ? (od1 - od2) / 2 : 0
  const a = 0.16 * L, b = 0.84 * L
  const f = fitter({ x0: 0, y0: -od1 / 2, x1: L, y1: od1 / 2 }, 78, 74, 62, 52)
  const { X, Y } = f

  const prof = (w1: number, w2: number) =>
    `M${X(0)} ${Y(-w1 / 2)} L${X(a)} ${Y(-w1 / 2)}` +
    ` L${X(b)} ${Y(off - w2 / 2)} L${X(L)} ${Y(off - w2 / 2)}` +
    ` L${X(L)} ${Y(off + w2 / 2)} L${X(b)} ${Y(off + w2 / 2)}` +
    ` L${X(a)} ${Y(w1 / 2)} L${X(0)} ${Y(w1 / 2)} Z`

  let s = ''
  s += `<path d="${prof(od1, od2)} ${prof(id1, id2)}" class="wall" fill-rule="evenodd"/>`
  s += centreLine(X(0) - 20, Y(0), X(L) + 20, Y(0))
  if (d.eccentric) s += centreLine(X(0) - 20, Y(off), X(L) + 20, Y(off))

  s += ext(X(0), Y(-od1 / 2), X(0) - 34, Y(-od1 / 2)) + ext(X(0), Y(od1 / 2), X(0) - 34, Y(od1 / 2))
  s += dimV(Y(-od1 / 2), Y(od1 / 2), X(0) - 26, `OD ${num(od1, 1)}`, 'left')
  s += ext(X(L), Y(off - od2 / 2), X(L) + 34, Y(off - od2 / 2)) +
       ext(X(L), Y(off + od2 / 2), X(L) + 34, Y(off + od2 / 2))
  s += dimV(Y(off - od2 / 2), Y(off + od2 / 2), X(L) + 26, `OD ${num(od2, 1)}`, 'right')

  const ly = Y(od1 / 2) + 34
  s += ext(X(0), Y(od1 / 2) + 4, X(0), ly + 4) + ext(X(L), Y(off + od2 / 2) + 4, X(L), ly + 4)
  s += dimH(X(0), X(L), ly, `L ${num(L, 1)}`)

  s += lead(X(a * 0.5), Y(-(od1 + id1) / 4), X(0) + 26, Y(-od1 / 2) - 26, `t ${num(d.t1)}`, 'start')
  s += lead(X(L - (L - b) * 0.5), Y(off - (od2 + id2) / 4), X(L) - 20, Y(off - od2 / 2) - 26, `t ${num(d.t2)}`, 'end')
  s += `<text x="${X(0)}" y="${Y(-od1 / 2) - 42}" class="dtx">ID ${num(id1)}</text>`
  s += `<text x="${X(L) + 30}" y="${Y(off + od2 / 2) + 20}" class="dtx" text-anchor="end">ID ${num(id2)}</text>`
  return svgWrap(s)
}

/* ---- welding cap ---- */

export function figCap(d: { length: number; od: number; id: number; t: number }): string {
  const { length: E, od, id, t } = d
  const skirt = Math.min(0.35 * E, E - od * 0.25)
  const f = fitter({ x0: 0, y0: -od / 2, x1: E, y1: od / 2 }, 80, 66, 58, 50)
  const { X, Y } = f

  const prof = (w: number, len: number) =>
    `M${X(0)} ${Y(-w / 2)} L${X(skirt)} ${Y(-w / 2)}` +
    ` Q${X(len)} ${Y(-w / 2)} ${X(len)} ${Y(0)}` +
    ` Q${X(len)} ${Y(w / 2)} ${X(skirt)} ${Y(w / 2)}` +
    ` L${X(0)} ${Y(w / 2)} Z`

  let s = ''
  s += `<path d="${prof(od, E)} ${prof(id, E - t)}" class="wall" fill-rule="evenodd"/>`
  s += centreLine(X(0) - 20, Y(0), X(E) + 16, Y(0))
  s += ext(X(0), Y(-od / 2), X(0) - 34, Y(-od / 2)) + ext(X(0), Y(od / 2), X(0) - 34, Y(od / 2))
  s += dimV(Y(-od / 2), Y(od / 2), X(0) - 26, `OD ${num(od, 1)}`, 'left')
  s += dimV(Y(-id / 2), Y(id / 2), X(0) + 18, `ID ${num(id)}`, 'right', -9)
  const ly = Y(od / 2) + 34
  s += ext(X(0), Y(od / 2) + 4, X(0), ly + 4) + ext(X(E), Y(0), X(E), ly + 4)
  s += dimH(X(0), X(E), ly, `E ${num(E, 1)}`)
  s += lead(X(skirt * 0.5), Y(-(od + id) / 4), X(0) + 30, Y(-od / 2) - 26, `t ${num(t)}`, 'start')
  return svgWrap(s)
}

/* ---- equal / reducing tee ---- */

export function figTee(d: {
  a: number; b: number
  odr: number; odb: number; idr: number; idb: number; tr: number
}): string {
  const { a: A, b: B, odr, odb, idr, idb } = d
  const f = fitter({ x0: -A, y0: -B, x1: A, y1: odr / 2 }, 76, 74, 68, 50)
  const { X, Y } = f

  const prof = (wr: number, wb: number) =>
    `M${X(-A)} ${Y(wr / 2)} L${X(A)} ${Y(wr / 2)} L${X(A)} ${Y(-wr / 2)}` +
    ` L${X(wb / 2)} ${Y(-wr / 2)} L${X(wb / 2)} ${Y(-B)}` +
    ` L${X(-wb / 2)} ${Y(-B)} L${X(-wb / 2)} ${Y(-wr / 2)}` +
    ` L${X(-A)} ${Y(-wr / 2)} Z`

  let s = ''
  s += `<path d="${prof(odr, odb)} ${prof(idr, idb)}" class="wall" fill-rule="evenodd"/>`
  s += centreLine(X(-A) - 18, Y(0), X(A) + 18, Y(0))
  s += centreLine(X(0), Y(-B) - 18, X(0), Y(odr / 2) + 12)

  s += ext(X(-A), Y(-odr / 2), X(-A) - 34, Y(-odr / 2)) + ext(X(-A), Y(odr / 2), X(-A) - 34, Y(odr / 2))
  s += dimV(Y(-odr / 2), Y(odr / 2), X(-A) - 26, `OD ${num(odr, 1)}`, 'left')
  const ty = Y(-B) - 30
  s += ext(X(-odb / 2), Y(-B), X(-odb / 2), ty - 4) + ext(X(odb / 2), Y(-B), X(odb / 2), ty - 4)
  s += dimH(X(-odb / 2), X(odb / 2), ty, `OD ${num(odb, 1)}`)
  const bx = X(odb / 2) + 40
  s += ext(X(odb / 2), Y(-B), bx + 4, Y(-B)) + ext(X(A), Y(0), bx + 4, Y(0))
  s += dimV(Y(-B), Y(0), bx, `B ${num(B, 1)}`, 'right')
  const ay = Y(odr / 2) + 32
  s += ext(X(0), Y(odr / 2) + 4, X(0), ay + 4) + ext(X(A), Y(odr / 2) + 4, X(A), ay + 4)
  s += dimH(X(0), X(A), ay, `A ${num(A, 1)}`)
  s += lead(X(-A) + 3, Y(-(odr + idr) / 4), X(-A) + 34, Y(-odr / 2) - 22, `t ${num(d.tr)}`, 'start')
  s += `<text x="${X(-A)}" y="${Y(odr / 2) + 18}" class="dtx">ID ${num(idr)} run</text>`
  s += `<text x="${bx + 4}" y="${Y(-B) - 8}" class="dtx" text-anchor="end">ID ${num(idb)} branch</text>`
  return svgWrap(s)
}

/* ---- pipe end view ---- */

export function figPipe(d: { od: number; id: number; t: number }): string {
  const { od, id } = d
  const f = fitter({ x0: -od / 2, y0: -od / 2, x1: od / 2, y1: od / 2 }, 80, 80, 46, 46)
  const { X, Y } = f
  const R = (od / 2) * f.s
  const r = (id / 2) * f.s

  let s = ''
  s +=
    `<path d="M${X(0) - R} ${Y(0)} a${R} ${R} 0 1 0 ${2 * R} 0 a${R} ${R} 0 1 0 ${-2 * R} 0 Z` +
    ` M${X(0) - r} ${Y(0)} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z" class="wall" fill-rule="evenodd"/>`
  s += centreLine(X(0) - R - 14, Y(0), X(0) + R + 14, Y(0))
  s += centreLine(X(0), Y(0) - R - 14, X(0), Y(0) + R + 14)
  s += ext(X(0) - R, Y(0), X(0) - R - 30, Y(0))
  s += dimV(Y(0) - R, Y(0) + R, X(0) - R - 22, `OD ${num(od, 1)}`, 'left')
  s += dimH(X(0) - r, X(0) + r, Y(0) - 8, `ID ${num(id)}`)
  s += lead(X(0) + R - (R - r) / 2, Y(0) + (R + r) / 2 * 0.7, X(0) + R + 26, Y(0) + R - 6, `t ${num(d.t)}`, 'start')
  return svgWrap(s)
}

/* ---- flange: face view on the left, section on the right ---- */

export function figFlange(d: {
  d: number; c: number; rf: number; bore: number; t: number
  hub: boolean; weld: boolean
}): string {
  const { d: D, c: C, rf: RF, bore: B, t, hub, weld } = d
  const gap = D * 0.55
  const secX = D + gap
  const secW = Math.max(t + (hub ? t * 1.6 : 0), D * 0.22)
  const f = fitter({ x0: 0, y0: -D / 2, x1: secX + secW, y1: D / 2 }, 62, 58, 40, 40)
  const { X, Y } = f
  const S = f.s
  const cx = X(D / 2), cy = Y(0)
  const rD = (D / 2) * S, rC = (C / 2) * S, rRF = (RF / 2) * S, rB = (B / 2) * S
  const circle = (r: number) =>
    `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`

  let s = ''
  s += `<path d="${circle(rD)} ${circle(rB)}" class="wall" fill-rule="evenodd"/>`
  s += `<path d="${circle(rRF)}" class="cl" fill="none"/>`
  const bh = Math.max(3, 0.045 * rD)
  for (const angle of [0, 90, 180, 270]) {
    const rad = angle * Math.PI / 180
    s += `<circle cx="${cx + rC * Math.cos(rad)}" cy="${cy + rC * Math.sin(rad)}" r="${bh}" class="wall"/>`
  }
  s += `<path d="${circle(rC)}" class="cl" fill="none"/>`
  s += centreLine(cx - rD - 10, cy, cx + rD + 10, cy) + centreLine(cx, cy - rD - 10, cx, cy + rD + 10)
  s += dimV(cy - rD, cy + rD, cx - rD - 14, `OD ${num(D, 0)}`, 'left')
  if (B > 0) s += dimH(cx - rB, cx + rB, cy - 6, `Bore ${num(B, 1)}`)
  else s += `<text x="${cx}" y="${cy + 4}" class="dtx" text-anchor="middle">solid</text>`
  s += lead(cx + rC * 0.707, cy - rC * 0.707, cx + rD + 4, cy - rD - 8, `PCD ${num(C, 1)}`, 'start')

  const bx = X(secX)
  const halfD = rD, halfRF = rRF, halfB = rB
  const tPx = t * S
  const rfPx = Math.max(2, 1.6 * S)
  const path =
    `M${bx} ${cy - halfD} h${tPx} v${halfD - halfRF} h${rfPx}` +
    ` v${2 * halfRF} h${-rfPx} v${halfD - halfRF} h${-tPx} Z`
  s += `<path d="${path}" class="wall"/>`
  if (hub) {
    const hubLen = t * 1.4 * S
    const neck = Math.max(halfB + 4 * S, halfB * 1.15)
    s +=
      `<path d="M${bx} ${cy - halfD} v${2 * halfD}` +
      ` M${bx} ${cy - neck} q${-hubLen} ${(neck - halfB) * 0.2} ${-hubLen} ${neck - halfB}` +
      ` M${bx} ${cy + neck} q${-hubLen} ${-(neck - halfB) * 0.2} ${-hubLen} ${-(neck - halfB)}` +
      '" class="wall" fill="none"/>'
  }
  s +=
    `<rect x="${bx - (hub ? t * 1.4 * S : 0)}" y="${cy - halfB}" ` +
    `width="${tPx + (hub ? t * 1.4 * S : 0) + rfPx}" height="${2 * halfB}" fill="#fff" stroke="none"/>`
  s += centreLine(bx - (hub ? t * 1.6 * S : 6), cy, bx + tPx + rfPx + 8, cy)
  s += ext(bx, cy - halfD, bx, cy - halfD - 20) + ext(bx + tPx, cy - halfD, bx + tPx, cy - halfD - 20)
  s += dimH(bx, bx + tPx, cy - halfD - 14, `t ${num(t, 1)}`)
  s += `<text x="${bx + tPx + rfPx + 6}" y="${cy + 4}" class="dtx">${weld ? 'WN' : hub ? 'hub' : 'flat'}</text>`
  return svgWrap(s)
}

/** Styles the figures need, shared by the app, the print sheet and the export. */
export const FIG_STYLE =
  '.wall{fill:#c9d6e8;stroke:#1e293b;stroke-width:1.3;}' +
  '.dim{stroke:#1e293b;stroke-width:1;fill:none;}' +
  '.ext{stroke:#94a3b8;stroke-width:0.7;}' +
  '.lead{stroke:#1e293b;stroke-width:0.8;fill:none;}' +
  '.cl{stroke:#64748b;stroke-width:0.8;fill:none;stroke-dasharray:7 3 2 3;}' +
  '.dtx{font-family:Arial,Helvetica,sans-serif;font-size:11px;fill:#0f172a;font-weight:bold;}' +
  '.figsvg{width:100%;height:auto;display:block;}'
