import { supabase } from '@/lib/supabase'
import { toApiError, countRows } from './api-errors'
import { toISO } from './row-values'
import {
  CREDIT_LEDGER_LIMIT, CreditBalanceSchema, CreditLedgerEntrySchema,
  type CreditBalance, type CreditLedgerEntry,
} from '@/types/credit'

/**
 * Số dư của chính user (RLS lọc). Chưa có dòng = chưa được cấp ví (trigger đăng ký / migration
 * backfill tạo sẵn nên hiếm) -> coi là 0, không phải lỗi.
 */
export async function getCreditBalance(): Promise<CreditBalance> {
  const { data, error } = await supabase
    .from('credit_balances').select('balance, unlimited').maybeSingle()
  if (error) throw toApiError(error)
  return CreditBalanceSchema.parse(data ?? { balance: 0, unlimited: false })
}

interface LedgerRow { id: number; delta: number; kind: string; created_at: string }

/** Sổ cái mới nhất trước. Không chọn `ref` (với dòng usage đó là id giao dịch — user không cần). */
export async function getCreditLedger(limit = CREDIT_LEDGER_LIMIT): Promise<CreditLedgerEntry[]> {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('id, delta, kind, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw toApiError(error)
  return ((data ?? []) as LedgerRow[]).map((r) => CreditLedgerEntrySchema.parse({
    id: r.id, delta: r.delta, kind: r.kind, createdAt: toISO(r.created_at),
  }))
}

/** Số tin đang chờ nạp credit (reason = no_credit, chưa ghi) — badge cảnh báo ở header. */
export async function getHeldCount(): Promise<number> {
  return countRows(
    supabase
      .from('unparsed_messages')
      .select('id', { count: 'exact', head: true })
      .eq('reason', 'no_credit')
      .eq('resolved', false),
  )
}
