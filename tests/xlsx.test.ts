import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { gridToCsv, readXlsx } from '@/lib/import/xlsx'

/** Minimal zip writer, so the test builds a real .xlsx rather than a fixture. */
function zip(files: { name: string; content: string; deflate?: boolean }[]): ArrayBuffer {
  const encoder = new TextEncoder()
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const raw = Buffer.from(encoder.encode(file.content))
    const stored = file.deflate ? deflateRawSync(raw) : raw
    const method = file.deflate ? 8 : 0

    const local = Buffer.alloc(30 + nameBytes.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(0, 14) // crc — not checked by the reader
    local.writeUInt32LE(stored.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    Buffer.from(nameBytes).copy(local, 30)
    locals.push(local, stored)

    const central = Buffer.alloc(46 + nameBytes.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(stored.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    Buffer.from(nameBytes).copy(central, 46)
    centrals.push(central)

    offset += local.length + stored.length
  }

  const centralBytes = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralBytes.length, 12)
  eocd.writeUInt32LE(offset, 16)

  const all = Buffer.concat([...locals, centralBytes, eocd])
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer
}

const SHARED = `<?xml version="1.0"?>
<sst><si><t>Code</t></si><si><t>Description</t></si><si><t>PVCFGO10063</t></si>
<si><r><t>90 deg elbow</t></r><r><t> 63mm SW</t></r></si></sst>`

const SHEET = `<?xml version="1.0"?>
<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Price, excl VAT</t></is></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>64.49</v></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>PVCCON1110</t></is></c><c r="C3"><v>0</v></c></row>
</sheetData></worksheet>`

describe('reading an xlsx', () => {
  it('reads shared strings, inline strings and numbers', async () => {
    const grid = await readXlsx(
      zip([
        { name: 'xl/sharedStrings.xml', content: SHARED },
        { name: 'xl/worksheets/sheet1.xml', content: SHEET, deflate: true },
      ]),
    )

    expect(grid[0]).toEqual(['Code', 'Description', 'Price, excl VAT'])
    expect(grid[1]).toEqual(['PVCFGO10063', '90 deg elbow 63mm SW', '64.49'])
  })

  it('keeps gaps in the right columns', async () => {
    const grid = await readXlsx(
      zip([
        { name: 'xl/sharedStrings.xml', content: SHARED },
        { name: 'xl/worksheets/sheet1.xml', content: SHEET },
      ]),
    )
    // B3 is absent, so the value in C3 must not slide left into it.
    expect(grid[2]).toEqual(['PVCCON1110', '', '0'])
  })

  it('re-serialises to CSV, quoting what needs it', async () => {
    const grid = await readXlsx(
      zip([
        { name: 'xl/sharedStrings.xml', content: SHARED },
        { name: 'xl/worksheets/sheet1.xml', content: SHEET },
      ]),
    )
    const csv = gridToCsv(grid)
    expect(csv.split('\n')[0]).toBe('Code,Description,"Price, excl VAT"')
  })

  it('rejects something that is not a zip', async () => {
    const notAZip = new TextEncoder().encode('this is a PDF, actually').buffer
    await expect(readXlsx(notAZip as ArrayBuffer)).rejects.toThrow(/not a zip file/)
  })
})
