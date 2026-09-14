'use client'

import { useState } from 'react'
import { publishableKey } from '@/lib/supabase/client'
import { readXlsx, gridToCsv } from '@/lib/import/xlsx'
import type {
  ChatAttachment,
  ChatImportReply,
  ChatTurn,
} from '@/lib/import/chat'
import type { StandardRow } from '@/lib/import/types'

const FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat-import`
  : null

/**
 * The function reports its failures as `{ error }` — a long list cut off
 * mid-row, a missing key, a file it declined to read. Show that sentence, not
 * the JSON it arrived in. Anything that is not JSON is a gateway error page,
 * and the status is the useful part of it.
 */
async function errorFrom(response: Response): Promise<string> {
  const body = await response.text()
  try {
    const parsed = JSON.parse(body) as { error?: unknown }
    if (typeof parsed.error === 'string') return parsed.error
  } catch {
    // Not JSON. Fall through.
  }
  return `${response.status} ${body}`.trim()
}

async function toAttachment(file: File): Promise<ChatAttachment> {
  const name = file.name
  const lower = name.toLowerCase()

  if (lower.endsWith('.pdf')) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    return { kind: 'pdf', name, base64: btoa(binary) }
  }

  if (lower.endsWith('.xlsx')) {
    // Read the sheet here rather than server-side, so the model sees a clean
    // grid instead of a zip it cannot open.
    return { kind: 'text', name, text: gridToCsv(await readXlsx(await file.arrayBuffer())) }
  }

  return { kind: 'text', name, text: await file.text() }
}

/**
 * The chat import panel.
 *
 * The model reads the supplier's file and proposes rows in the standard shape.
 * It writes nothing — its output goes to the same diff and the same
 * confirmation dialogue as a hand-made CSV. The API key lives in the edge
 * function and never reaches the browser.
 */
export function ChatImportPanel({
  supplierName,
  effectiveFrom,
  disabled,
  onRows,
}: {
  supplierName: string
  effectiveFrom: string
  disabled: boolean
  onRows: (rows: StandardRow[], fileName: string | null) => void
}) {
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [reply, setReply] = useState<ChatImportReply | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!FUNCTION_URL) {
    return (
      <p className="banner amber">
        Chat import needs <code>NEXT_PUBLIC_SUPABASE_URL</code>. Use the standard CSV path
        meanwhile.
      </p>
    )
  }

  async function send(nextTurns: ChatTurn[], file: ChatAttachment | null) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(FUNCTION_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publishableKey ?? '',
          Authorization: `Bearer ${publishableKey ?? ''}`,
        },
        body: JSON.stringify({ turns: nextTurns, attachment: file, supplierName, effectiveFrom }),
      })

      if (!response.ok) throw new Error(await errorFrom(response))

      const result = (await response.json()) as ChatImportReply
      setReply(result)
      setTurns([...nextTurns, { role: 'assistant', text: result.message }])
    } catch (cause) {
      // A blocked cross-origin request never reaches the function, so the
      // browser hands back a bare TypeError with nothing in it. Name the most
      // likely cause rather than showing 'Failed to fetch'.
      setError(
        cause instanceof TypeError
          ? 'Could not reach the chat import function — it may not be deployed, or this ' +
            'site may not be in its ALLOWED_ORIGINS.'
          : cause instanceof Error
            ? cause.message
            : String(cause),
      )
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File) {
    try {
      const next = await toAttachment(file)
      setAttachment(next)
      const opening: ChatTurn[] = [
        { role: 'user', text: `Read ${file.name} and give me the price rows.` },
      ]
      setTurns(opening)
      await send(opening, next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <>
      <p className="note">
        Drop the supplier&rsquo;s file in any layout — PDF, Excel or CSV. The model proposes
        rows; it writes nothing. You will see the same diff and the same confirmation as the
        CSV path.
      </p>

      <input
        type="file"
        accept=".pdf,.csv,.txt,.xlsx,.tsv"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onFile(file)
        }}
      />
      {disabled && <p className="note">Give the supplier and effective date first.</p>}
      {error && <p className="banner amber">{error}</p>}

      {turns.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {turns.map((turn, index) => (
            <p key={index} style={{ margin: '6px 0' }}>
              <strong>{turn.role === 'user' ? 'You' : 'Model'}:</strong> {turn.text}
            </p>
          ))}
        </div>
      )}

      {reply?.interpretation && (
        <fieldset style={{ marginTop: 12 }}>
          <legend>What it decided</legend>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Code: {reply.interpretation.code}</li>
            <li>Description: {reply.interpretation.description}</li>
            <li>Unit: {reply.interpretation.unit}</li>
            <li>Price: {reply.interpretation.price}</li>
          </ul>
          {reply.interpretation.notes.length > 0 && (
            <ul className="note" style={{ paddingLeft: 20 }}>
              {reply.interpretation.notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          )}
          <p className="note">
            Check that against the file before going on. If a column is wrong, say so below —
            it is faster than fixing 600 rows afterwards.
          </p>
        </fieldset>
      )}

      {reply && (
        <>
          <div className="toolbar">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. the price column is the second one, not the third"
              style={{ flex: 1, minWidth: 280, font: 'inherit', padding: '5px 8px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && draft.trim() && !busy) {
                  const next: ChatTurn[] = [...turns, { role: 'user', text: draft.trim() }]
                  setDraft('')
                  void send(next, attachment)
                }
              }}
            />
            <button
              className="action"
              disabled={busy || draft.trim() === ''}
              onClick={() => {
                const next: ChatTurn[] = [...turns, { role: 'user', text: draft.trim() }]
                setDraft('')
                void send(next, attachment)
              }}
            >
              Send
            </button>
          </div>

          <div className="toolbar">
            <button
              className="action primary"
              disabled={busy || reply.rows.length === 0}
              onClick={() => onRows(reply.rows, attachment?.name ?? null)}
            >
              Use these {reply.rows.length} rows →
            </button>
            <span className="note">Next step is the diff. Nothing is written yet.</span>
          </div>
        </>
      )}

      {busy && <p className="note">Reading…</p>}
    </>
  )
}
