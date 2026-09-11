/**
 * The masthead, ported from Piping_15.html.
 *
 * It is a component rather than part of the root layout because the price
 * schedule replaces it with its own heading, exactly as `viewPrices()` did in
 * the old file — there the whole `#dashboard` was hidden, masthead included.
 */

export function GeaLogo() {
  return (
    <svg
      className="gea-logo"
      viewBox="-0.6 -0.6 79.6 26.2"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="GEA"
    >
      <g fill="#0303B8">
        <path
          d="M21 2.05 H9.2 A7.15 7.15 0 0 0 2.05 9.2 V13.4 A9.55 9.55 0 0 0 11.6 22.95 H22.9"
          fill="none"
          stroke="#0303B8"
          strokeWidth="4.1"
        />
        <path d="M19 10 H22.9 V25 H19 Z" />
        <path d="M12 10 H65.4 L67.2 14.1 H11 Z" />
        <path d="M29 0 H47 V4.1 H33.1 V20.9 H47 L45 25 H29 Z" />
        <path d="M59.8 0 H64.8 L53.6 25 H48.6 Z" />
        <path d="M62.2 0 H67.2 L78.4 25 H73.4 Z" />
      </g>
    </svg>
  )
}

export function PageHead({ lede }: { lede?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div className="titles">
        <h2>Pipe &amp; Fittings Dimension Dashboard</h2>
        <p className="lede">
          {lede ?? (
            <>
              Dimensions to ASTM A106 / API 5L, ANSI B 36.19, ANSI B 16.9 and B 16.28 &mdash; all
              dimensions in mm
              <br />
              Click any row to preview its drawing; tick the box to add it to your list.
            </>
          )}
        </p>
      </div>
      <div className="brand">
        <GeaLogo />
      </div>
    </div>
  )
}

/**
 * Heading for the pages the old single-file tool did not have — import and
 * history. It borrows the price schedule's head so they read as part of the
 * same tool, and always offers the way back to the dimensions.
 */
export function SubPageHead({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <>
      <div className="price-head">
        <div>
          <h3>{title}</h3>
          {meta && <p id="price-meta">{meta}</p>}
        </div>
        <div className="brand">
          <GeaLogo />
        </div>
      </div>
      <div className="price-actions">
        <a className="btn-action btn-back" href="/">
          &larr; Back to dimensions
        </a>
      </div>
    </>
  )
}
