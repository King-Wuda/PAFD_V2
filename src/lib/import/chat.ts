import type { StandardRow } from './types'

/** What the model says it decided, shown to the user before anything is used (§6.2). */
export interface ColumnInterpretation {
  code: string
  description: string
  unit: string
  price: string
  /** Anything the model wants to flag — skipped pages, odd units, VAT basis. */
  notes: string[]
}

export interface ChatImportReply {
  /** The model's message to the user. */
  message: string
  interpretation: ColumnInterpretation | null
  /** Proposed rows only. The model writes nothing (§6.2). */
  rows: StandardRow[]
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

/** The document handed to the edge function. */
export type ChatAttachment =
  | { kind: 'pdf'; name: string; base64: string }
  | { kind: 'text'; name: string; text: string }

export interface ChatImportRequest {
  turns: ChatTurn[]
  attachment: ChatAttachment | null
  supplierName: string
  effectiveFrom: string
}
