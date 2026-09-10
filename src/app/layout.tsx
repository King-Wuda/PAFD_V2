import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Piping & Fittings',
  description: 'Pipe and fitting sizing with shared, current supplier prices.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <header className="app">
          <h1>Piping &amp; Fittings</h1>
          <nav>
            <Link href="/">Catalogue</Link>
            <Link href="/import">Import prices</Link>
            <Link href="/history">History</Link>
            <Link href="/export" prefetch={false}>Offline copy</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
