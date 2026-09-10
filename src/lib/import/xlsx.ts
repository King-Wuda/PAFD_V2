/**
 * Minimal .xlsx reader — enough to turn a supplier's spreadsheet into rows of
 * strings for the chat importer to interpret.
 *
 * Deliberately dependency-free. An xlsx is a zip of XML, and both halves are
 * small: the zip central directory plus DecompressionStream for the deflate,
 * then the shared string table and the sheet's cells. That is cheaper than
 * carrying a spreadsheet library into the bundle for one import path, and it
 * keeps supplier files off any third-party parser.
 *
 * It reads values, not formulas, formatting or dates-as-serials — which is all
 * the importer needs, because the model reads the grid as text.
 */

interface ZipEntry {
  name: string
  bytes: Uint8Array
}

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(
    new DecompressionStream('deflate-raw'),
  )
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Read the entries we care about out of a zip archive. */
async function readZip(buffer: ArrayBuffer, wanted: (name: string) => boolean): Promise<ZipEntry[]> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)

  // Locate the end-of-central-directory record, scanning back past any comment.
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 0xffff; i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error('not a zip file (no end-of-central-directory record)')

  const entryCount = u16(view, eocd + 10)
  let cursor = u32(view, eocd + 16)
  const entries: ZipEntry[] = []

  for (let i = 0; i < entryCount; i++) {
    if (u32(view, cursor) !== 0x02014b50) throw new Error('corrupt zip central directory')

    const method = u16(view, cursor + 10)
    const compressedSize = u32(view, cursor + 20)
    const nameLength = u16(view, cursor + 28)
    const extraLength = u16(view, cursor + 30)
    const commentLength = u16(view, cursor + 32)
    const localOffset = u32(view, cursor + 42)
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))

    cursor += 46 + nameLength + extraLength + commentLength

    if (!wanted(name)) continue

    // The local header repeats the name and carries its own extra field length.
    const localNameLength = u16(view, localOffset + 26)
    const localExtraLength = u16(view, localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const raw = bytes.subarray(start, start + compressedSize)

    entries.push({
      name,
      bytes: method === 0 ? raw : await inflateRaw(raw),
    })
  }

  return entries
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
}

function decodeXmlText(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16))
    }
    if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)))
    return XML_ENTITIES[entity] ?? whole
  })
}

/** Concatenated <t> runs — a shared string can be split across formatting runs. */
function textOf(xml: string): string {
  const parts = xml.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) ?? []
  return parts
    .map((part) => decodeXmlText(part.replace(/^<t(?:\s[^>]*)?>/, '').replace(/<\/t>$/, '')))
    .join('')
}

function parseSharedStrings(xml: string): string[] {
  const items = xml.match(/<si>[\s\S]*?<\/si>/g) ?? []
  return items.map(textOf)
}

/** "BC12" -> 54 (zero-based column index). */
function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/)?.[0] ?? 'A'
  let index = 0
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index - 1
}

function parseSheet(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = []

  for (const rowXml of xml.match(/<row[\s\S]*?(?:\/>|<\/row>)/g) ?? []) {
    const cells: string[] = []

    for (const cellXml of rowXml.match(/<c[\s\S]*?(?:\/>|<\/c>)/g) ?? []) {
      const reference = cellXml.match(/\sr="([A-Z]+\d+)"/)?.[1]
      const type = cellXml.match(/\st="(\w+)"/)?.[1]

      let value = ''
      if (type === 'inlineStr') {
        value = textOf(cellXml)
      } else {
        const raw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        if (raw !== undefined) {
          value = type === 's' ? (sharedStrings[Number(raw)] ?? '') : decodeXmlText(raw)
        }
      }

      const index = reference ? columnIndex(reference) : cells.length
      while (cells.length < index) cells.push('')
      cells[index] = value
    }

    rows.push(cells)
  }

  return rows
}

/**
 * Read the first worksheet of an .xlsx as a grid of strings.
 * Blank trailing rows are dropped; blank cells become ''.
 */
export async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const entries = await readZip(
    buffer,
    (name) => name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  )

  const sheets = entries
    .filter((entry) => entry.name.startsWith('xl/worksheets/'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  if (sheets.length === 0) throw new Error('no worksheet found in this .xlsx')

  const decoder = new TextDecoder()
  const sharedEntry = entries.find((entry) => entry.name === 'xl/sharedStrings.xml')
  const sharedStrings = sharedEntry ? parseSharedStrings(decoder.decode(sharedEntry.bytes)) : []

  const rows = parseSheet(decoder.decode(sheets[0].bytes), sharedStrings)

  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === '')) {
    rows.pop()
  }
  return rows
}

/** Re-serialise a grid as CSV so every import path speaks the same language. */
export function gridToCsv(rows: readonly string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(','),
    )
    .join('\n')
}
