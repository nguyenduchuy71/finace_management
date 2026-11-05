import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResolveKind, ResolveTxInput } from '@/types/unparsed'

/**
 * Phân loại tin trong test integration. Production đi qua edge function `resolve-unparsed` (xác thực JWT rồi gọi RPC);
 * stack local của test không `functions serve`, nên gọi THẲNG RPC `resolve_unparsed_charged` bằng service_role với
 * p_user = user test — đúng thứ function gọi. Lớp HTTP (401/402/403, map lỗi) được phủ ở Deno test
 * supabase/functions/resolve-unparsed/handler.test.ts và vitest src/services/unparsed-messages.test.ts.
 * Lỗi ném ra có `code` = SQLSTATE của RPC (22003 hết credit, 22023 sai/đã xử lý, P0002 không thấy, 42501 bị khoá).
 */
export async function resolveViaRpc(
  admin: SupabaseClient, userId: string, messageId: string, kind: ResolveKind, tx?: ResolveTxInput,
): Promise<string | null> {
  const { data, error } = await admin.rpc('resolve_unparsed_charged', {
    p_user: userId,
    p_msg_id: messageId,
    p_kind: kind,
    p_tx: tx
      ? {
          amount: tx.amount,
          transaction_date: tx.transactionDate,
          description: tx.description ?? null,
          merchant_name: tx.merchantName ?? null,
          account_id: tx.accountId ?? null,
          card_id: tx.cardId ?? null,
        }
      : null,
  })
  if (error) throw error
  return data as string | null
}

/**
 * Trả sổ cái về trạng thái trước test: xoá dòng usage của các giao dịch test đã tạo (giao dịch bị xoá cascade cùng TK)
 * rồi tính lại balance = sum(delta) (bất biến của sổ cái). Chạy cả ở beforeAll để dọn sót của lần crash.
 */
export async function restoreCreditAfterTest(admin: SupabaseClient, userId: string, txIds: string[]): Promise<void> {
  if (txIds.length) {
    const { error } = await admin.from('credit_ledger').delete().eq('user_id', userId).eq('kind', 'usage').in('ref', txIds)
    if (error) throw error
  }
  const { data, error } = await admin.from('credit_ledger').select('delta').eq('user_id', userId)
  if (error) throw error
  const balance = data.reduce((s, r) => s + (r.delta as number), 0)
  const upd = await admin.from('credit_balances').update({ balance }).eq('user_id', userId)
  if (upd.error) throw upd.error
}
