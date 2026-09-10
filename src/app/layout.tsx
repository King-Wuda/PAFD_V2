import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pipe & Fittings Dimension Dashboard',
  description: 'Pipe and fitting sizing with shared, current supplier prices.',
}

/** The GEA mark, ported from Piping_15.html so the sheet prints as before. */
function GeaLogo() {
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <header className="app">
          <div className="titles">
            <h1>Pipe &amp; Fittings Dimension Dashboard</h1>
            <p className="lede">
              Dimensions to ASTM A106 / API 5L, ANSI B 36.19, ANSI B 16.9 and B 16.28 &mdash; all
              dimensions in mm
              <br />
              Click any row to preview its drawing; tick the box to add it to your list.
            </p>
            <nav className="no-print">
              <Link href="/">Catalogue</Link>
              <Link href="/import">Import prices</Link>
              <Link href="/history">History</Link>
              <Link href="/export" prefetch={false}>
                Offline copy
              </Link>
            </nav>
          </div>
          <div className="brand">
            <GeaLogo />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
