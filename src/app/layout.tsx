import type { Metadata } from 'next'
import { FIG_STYLE } from '@/lib/drawings'
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
      <body>
        {/*
          The figure styles live with the figure generator rather than in
          globals.css, so the screen, the print sheet and the offline export
          cannot drift apart. Without them every SVG falls back to a solid
          black fill, which is what a drawing looks like with no stylesheet.

          In the body, not the head: the App Router owns <head> and drops
          arbitrary children from it. A <style> element is valid here.
        */}
        <style id="fig-style" dangerouslySetInnerHTML={{ __html: FIG_STYLE }} />
        {children}
      </body>
    </html>
  )
}
