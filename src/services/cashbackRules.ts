import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { CashbackRuleSchema } from '@/types/cashback'
import type { CashbackFormValues } from '@/types/cashback-form'
import type { ApiError } from '@/types/api'
import type { CreditCardTransaction } from '@/types/creditCard'
import { exportTransactions } from './exports'
import { toApiError } from './mappers'

interface CashbackRuleRow {
  id: string
  card_id: string
  mcc: string | null
  // numeric/bigint của Postgres có thể về dạng chuỗi tuỳ driver
  rate_percent: number | string
  min_cycle_spend: number | string
  cap_per_cycle: number | string | null
}

const COLUMNS = 'id, card_id, mcc, rate_percent, min_cycle_spend, cap_per_cycle'

function mapRule(row: CashbackRuleRow) {
  return CashbackRuleSchema.parse({
    id: row.id,
    cardId: row.card_id,
    mcc: row.mcc,
    ratePercent: Number(row.rate_percent),
    minCycleSpend: Math.round(Number(row.min_cycle_spend)),
    capPerCycle: row.cap_per_cycle === null ? null : Math.round(Number(row.cap_per_cycle)),
  })
}

function toRow(v: CashbackFormValues) {
  return {
    mcc: v.mcc,
    rate_percent: v.ratePercent,
    min_cycle_spend: v.minCycleSpend,
    cap_per_cycle: v.capPerCycle,
  }
}

/** Trùng (thẻ, MCC) — kể cả hai rule mặc định — đáng được một thông điệp riêng, không phải "Dữ liệu đã tồn tại". */
function fail(error: PostgrestError): ApiError {
  if (error.code === '23505') {
    return { code: '23505', message: 'Thẻ này đã có rule cho nhóm đó. Sửa rule hiện có thay vì thêm mới.' }
  }
  return toApiError(error)
}

/** Rule của một thẻ: rule theo MCC trước, rule mặc định (mcc NULL) cuối cùng. */
export async function listCashbackRules(cardId: string) {
  const { data, error } = await supabase
    .from('card_cashback_rules')
    .select(COLUMNS)
    .eq('card_id', cardId)
    .order('mcc', { ascending: true, nullsFirst: false })
  if (error) throw toApiError(error)
  return ((data ?? []) as CashbackRuleRow[]).map(mapRule)
}

// Không gửi `user_id`: cột có default auth.uid() và RLS kiểm lại (kể cả thẻ phải thuộc user).
export async function createCashbackRule(cardId: string, values: CashbackFormValues) {
  const { data, error } = await supabase
    .from('card_cashback_rules')
    .insert({ card_id: cardId, ...toRow(values) })
    .select(COLUMNS)
    .single()
  if (error) throw fail(error)
  return mapRule(data as CashbackRuleRow)
}

export async function updateCashbackRule(ruleId: string, values: CashbackFormValues) {
  const { data, error } = await supabase
    .from('card_cashback_rules')
    .update(toRow(values))
    .eq('id', ruleId)
    .select(COLUMNS)
    .single()
  if (error) throw fail(error)
  return mapRule(data as CashbackRuleRow)
}

/** RLS lọc 0 dòng thì PostgREST vẫn báo thành công: tự kiểm để không "xoá thành công" mà không xoá gì. */
export async function deleteCashbackRule(ruleId: string): Promise<void> {
  const { data, error } = await supabase
    .from('card_cashback_rules')
    .delete()
    .eq('id', ruleId)
    .select('id')
  if (error) throw toApiError(error)
  if (!data || data.length === 0) {
    throw { code: 'NOT_FOUND', message: 'Không tìm thấy rule (đã bị xoá hoặc không thuộc về bạn).' } satisfies ApiError
  }
}

/**
 * Toàn bộ giao dịch CHI của thẻ trong một chu kỳ sao kê, nửa mở [start, end): giao dịch đúng
 * 00:00 VN của ngày bắt đầu thuộc chu kỳ này, đúng 00:00 VN của ngày sau ngày sao kê thì thuộc
 * chu kỳ kế. Tự lật trang (PostgREST cắt cứng ở 1000 dòng) qua exportTransactions.
 */
export async function getCycleExpenses(cardId: string, startISO: string, endISO: string) {
  const res = await exportTransactions(null, {
    cardId,
    dateFrom: startISO,
    dateBefore: endISO,
    txType: 'expense',
  })
  return res.data as CreditCardTransaction[]
}
