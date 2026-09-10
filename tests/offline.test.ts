import { describe, expect, it } from 'vitest'
import { embedJson, renderOfflineHtml } from '@/lib/export/offline'
import type { CurrentPrice } from '@/lib/prices/types'

const prices: CurrentPrice[] = [
  {
    supplier: 'Thermoplastics Co',
    code: 'PVCFGO10063',
    description: '90 deg elbow 63mm SW',
    unit: 'each',
    price: 64.49,
    effectiveFrom: '2026-04-15',
    priceListId: 'list-1',
    onCurrentList: true,
    supplierCurrentFrom: '2026-04-15',
  },
]

describe('the offline copy', () => {
  const html = renderOfflineHtml(prices, new Date('2026-09-09T10:00:00Z'))

  it('is one self-contained file with no network references', () => {
    expect(html).not.toMatch(/<script[^>]+src=/i)
    expect(html).not.toMatch(/<link[^>]+href=/i)
    expect(html).not.toMatch(/https?:\/\//)
  })

  it('stamps when it was exported and how old the prices are', () => {
    expect(html).toContain('exported 2026-09-09')
    expect(html).toContain('prices effective 15 Apr 2026')
    expect(html).toContain('It will not update')
  })

  it('says so plainly when there are no prices to bake in', () => {
    expect(renderOfflineHtml([])).toContain('no prices loaded')
  })

  it('escapes embedded data so a supplier description cannot close the script tag', () => {
    // Descriptions come from supplier PDFs we do not control.
    const embedded = embedJson({ description: '</script><img src=x onerror=alert(1)>' })
    expect(embedded).not.toContain('</script>')
    expect(embedded).toContain('\\u003c/script\\u003e')
  })

  it('escapes the line separators that would break the script', () => {
    expect(embedJson('a\u2028b\u2029c')).toBe('"a\\u2028b\\u2029c"')
  })
})
