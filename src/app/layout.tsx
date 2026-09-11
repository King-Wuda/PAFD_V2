import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pipe & Fittings Dimension Dashboard',
  description: 'Pipe and fitting sizing with shared, current supplier prices.',
}

/*
 * Deliberately bare. The old file's body held one `#dashboard` div and one
 * `#prices-view` div and swapped between them, so the masthead belongs to the
 * view rather than to the shell — see PageHead.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>{children}</body>
    </html>
  )
}
