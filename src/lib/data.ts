import { getSupabase, isConfigured } from '@/lib/supabase/client'
import type { CurrentPrice } from '@/lib/prices/types'
import type { StandardRow } from '@/lib/import/types'
import type { PricedCode } from '@/lib/import/diff'

export interface Supplier {
  id: string
  name: string
}

export interface PriceListRecord {
  id: string
  supplierId: string
  supplierName: string
  effectiveFrom: string
  sourceFile: string | null
  notes: string | null
  importedAt: string
  importedBy: string | null
  superseded: boolean
  rowCount: number
}

interface CurrentPriceRow {
  supplier: string
  code: string
  description: string | null
  unit: string | null
  price: number | string | null
  effective_from: string
  price_list_id: string
  on_current_list: boolean
  supplier_current_from: string | null
}

function toCurrentPrice(row: CurrentPriceRow): CurrentPrice {
  return {
    supplier: row.supplier,
    code: row.code,
    description: row.description,
    unit: row.unit,
    // numeric(12,2) arrives as a string over PostgREST.
    price: row.price === null ? null : Number(row.price),
    effectiveFrom: row.effective_from,
    priceListId: row.price_list_id,
    onCurrentList: row.on_current_list,
    supplierCurrentFrom: row.supplier_current_from,
  }
}

/** Every current price, for every supplier. Fetched once at page load (§9). */
export async function fetchCurrentPrices(): Promise<CurrentPrice[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const all: CurrentPrice[] = []
  const pageSize = 1000

  // PostgREST caps a response at 1000 rows by default; the catalogue is larger.
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('current_prices')
      .select('*')
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`fetching current prices: ${error.message}`)
    if (!data || data.length === 0) break

    all.push(...(data as CurrentPriceRow[]).map(toCurrentPrice))
    if (data.length < pageSize) break
  }

  return all
}

/** What we already hold for one supplier — the left-hand side of an import diff. */
export async function fetchSupplierPrices(supplierName: string): Promise<PricedCode[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('current_prices')
    .select('code, description, price, effective_from')
    .eq('supplier', supplierName)

  if (error) throw new Error(`fetching supplier prices: ${error.message}`)

  return (data ?? []).map((row) => ({
    code: row.code as string,
    description: row.description as string | null,
    price: row.price === null ? null : Number(row.price),
    effectiveFrom: row.effective_from as string,
  }))
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase.from('suppliers').select('id, name').order('name')
  if (error) throw new Error(`fetching suppliers: ${error.message}`)
  return (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string }))
}

/** Every import, newest first. The History page (§8). */
export async function fetchPriceLists(): Promise<PriceListRecord[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('price_lists')
    .select('*, suppliers(name)')
    .order('imported_at', { ascending: false })

  if (error) throw new Error(`fetching price lists: ${error.message}`)

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    supplierId: row.supplier_id as string,
    supplierName: (row.suppliers as { name: string } | null)?.name ?? 'Unknown',
    effectiveFrom: row.effective_from as string,
    sourceFile: (row.source_file as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    importedAt: row.imported_at as string,
    importedBy: (row.imported_by as string | null) ?? null,
    superseded: row.superseded as boolean,
    rowCount: row.row_count as number,
  }))
}

/** The rows of one import, for the history diff view. */
export async function fetchListPrices(priceListId: string): Promise<PricedCode[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('prices')
    .select('code, description, price')
    .eq('price_list_id', priceListId)

  if (error) throw new Error(`fetching list prices: ${error.message}`)

  return (data ?? []).map((row) => ({
    code: row.code as string,
    description: row.description as string | null,
    price: row.price === null ? null : Number(row.price),
  }))
}

export interface ImportRequest {
  supplierName: string
  effectiveFrom: string
  sourceFile: string | null
  notes: string | null
  importedBy: string
  rows: StandardRow[]
}

/**
 * Write one import.
 *
 * A single RPC, so the price_lists row and all its prices land in one
 * transaction. Nothing existing is touched (§6.4).
 */
export async function importPriceList(request: ImportRequest): Promise<string> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Price database is not configured — cannot import.')

  const { data, error } = await supabase.rpc('import_price_list', {
    p_supplier_name: request.supplierName,
    p_effective_from: request.effectiveFrom,
    p_source_file: request.sourceFile,
    p_notes: request.notes,
    p_imported_by: request.importedBy,
    p_rows: request.rows.map((row) => ({
      code: row.code,
      description: row.description,
      unit: row.unit,
      price: row.price === null ? null : String(row.price),
    })),
  })

  if (error) throw new Error(`import failed: ${error.message}`)
  return data as string
}

/** Rollback, and its undo. One click, no data loss (§8). */
export async function setPriceListSuperseded(
  priceListId: string,
  superseded: boolean,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Price database is not configured.')

  const { error } = await supabase.rpc('set_price_list_superseded', {
    p_price_list_id: priceListId,
    p_superseded: superseded,
  })
  if (error) throw new Error(`rollback failed: ${error.message}`)
}

/**
 * Newest import timestamp. Polled to decide whether to show the quiet
 * "New price list available — reload" banner. Prices are never hot-swapped
 * under someone mid-quote (§9).
 */
export async function fetchLatestImportedAt(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('price_lists')
    .select('imported_at')
    .eq('superseded', false)
    .order('imported_at', { ascending: false })
    .limit(1)

  if (error) return null
  return (data?.[0]?.imported_at as string | undefined) ?? null
}

export { isConfigured }
