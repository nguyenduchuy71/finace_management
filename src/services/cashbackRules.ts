import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'
import { CashbackRuleSchema } from '@/types/cashback'
import type { CashbackRuleInput } from '@/types/cashback'
import type { ApiError } from '@/types/api'
import { exportCardTransactions } from './exports'
import { toInt } from './row-values'
import { toApiError, requireAffected, CARD_NOT_FOUND } from './api-errors'

interface CashbackTierRow {
  min_spend: number | string
  rate_percent: number | string
}

interface CashbackRuleRow {
  id: string
  card_id: string
  mcc: string | null
  // numeric/bigint của Postgres có thể về dạng chuỗi tuỳ driver
  rate_percent: number | string
  min_cycle_spend: number | string
  cap_per_cycle: number | string | null
  card_cashback_rule_tiers?: CashbackTierRow[] | null
}

// Bậc thêm lấy kèm rule bằng embed của PostgREST (một request, RLS vẫn áp cho bảng con).
const COLUMNS =
  'id, card_id, mcc, rate_percent, min_cycle_spend, cap_per_cycle, card_cashback_rule_tiers(min_spend, rate_percent)'

function mapRule(row: CashbackRuleRow) {
  return CashbackRuleSchema.parse({
    id: row.id,
    cardId: row.card_id,
    mcc: row.mcc,
    ratePercent: Number(row.rate_percent),
    minCycleSpend: toInt(row.min_cycle_spend),
    capPerCycle: row.cap_per_cycle === null ? null : toInt(row.cap_per_cycle),
    tiers: (row.card_cashback_rule_tiers ?? [])
      .map((t) => ({ minSpend: toInt(t.min_spend), ratePercent: Number(t.rate_percent) }))
      .sort((a, b) => a.minSpend - b.minSpend),
  })
}

const RULE_NOT_FOUND = 'Không tìm thấy rule (đã bị xoá hoặc không thuộc về bạn).'

const RULE_ERRORS: Record<string, string> = {
  // Trùng (thẻ, MCC) — kể cả hai rule mặc định — đáng được một thông điệp riêng, không phải "Dữ liệu đã tồn tại".
  '23505': 'Thẻ này đã có rule cho nhóm đó. Sửa rule hiện có thay vì thêm mới.',
  P0002: RULE_NOT_FOUND,
}

function fail(error: PostgrestError): ApiError {
  // 22023: RPC save_cashback_rule từ chối bậc thang sai; thông điệp do chính hàm đó viết (tiếng Việt, không lộ nội bộ).
  if (error.code === '22023') return { code: '22023', message: error.message }
  return toApiError(error, RULE_ERRORS)
}

/** Rule của một thẻ: rule theo MCC trước, rule mặc định (mcc NULL) cuối cùng. */
export async function listCashbackRules(cardId: string) {
  const { data, error } = await supabase
    .from('card_cashback_rules')
    .select(COLUMNS)
    .eq('card_id', cardId)
    .order('mcc', { ascending: true, nullsFirst: false })
  if (error) throw toApiError(error)
  return ((data ?? []) as unknown as CashbackRuleRow[]).map(mapRule)
}

/**
 * Tạo (ruleId = null) hoặc sửa rule CÙNG TOÀN BỘ bậc thang trong một lời gọi RPC, nên không bao
 * giờ để lại rule nửa vời (rule đã lưu mà bậc lỗi). RPC thay thế bậc cũ bằng `values.tiers`.
 * Không gửi `user_id`: cột có default auth.uid() và RLS kiểm lại (kể cả thẻ phải thuộc user).
 */
async function saveRule(cardId: string, ruleId: string | null, values: CashbackRuleInput) {
  const { data: id, error } = await supabase.rpc('save_cashback_rule', {
    p_card_id: cardId,
    p_rule_id: ruleId,
    p_mcc: values.mcc,
    p_rate: values.ratePercent,
    p_min: values.minCycleSpend,
    p_cap: values.capPerCycle,
    p_tiers: values.tiers,
  })
  if (error) throw fail(error)

  const { data, error: readError } = await supabase
    .from('card_cashback_rules')
    .select(COLUMNS)
    .eq('id', z.uuid().parse(id)) // RPC trả về id rule; kiểm ở biên như mọi phản hồi khác
    .single()
  if (readError) throw fail(readError)
  return mapRule(data as unknown as CashbackRuleRow)
}

export function createCashbackRule(cardId: string, values: CashbackRuleInput) {
  return saveRule(cardId, null, values)
}

export function updateCashbackRule(cardId: string, ruleId: string, values: CashbackRuleInput) {
  return saveRule(cardId, ruleId, values)
}

/** Đặt (hoặc bỏ, `null`) trần hoàn tiền tổng của thẻ. Tự kiểm 0 dòng như deleteCashbackRule. */
export async function setCardCashbackCap(cardId: string, cap: number | null): Promise<void> {
  const { data, error } = await supabase
    .from('credit_cards')
    .update({ cashback_monthly_cap: cap })
    .eq('id', cardId)
    .select('id')
  if (error) throw toApiError(error)
  requireAffected(data, CARD_NOT_FOUND)
}

/** RLS lọc 0 dòng thì PostgREST vẫn báo thành công: tự kiểm để không "xoá thành công" mà không xoá gì. */
export async function deleteCashbackRule(ruleId: string): Promise<void> {
  const { data, error } = await supabase
    .from('card_cashback_rules')
    .delete()
    .eq('id', ruleId)
    .select('id')
  if (error) throw toApiError(error)
  requireAffected(data, RULE_NOT_FOUND)
}

/**
 * Toàn bộ giao dịch CHI của thẻ trong một chu kỳ sao kê, nửa mở [start, end): giao dịch đúng
 * 00:00 VN của ngày bắt đầu thuộc chu kỳ này, đúng 00:00 VN của ngày sau ngày sao kê thì thuộc
 * chu kỳ kế. Tự lật trang (PostgREST cắt cứng ở 1000 dòng) qua exportCardTransactions.
 */
export async function getCycleExpenses(cardId: string, startISO: string, endISO: string) {
  const res = await exportCardTransactions(cardId, {
    dateFrom: startISO,
    dateBefore: endISO,
    txType: 'expense',
  })
  return res.data
}
