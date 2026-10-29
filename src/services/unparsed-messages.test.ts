import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { supabase } from '@/lib/supabase'
import { resolveUnparsed } from './unparsed-messages'

const invoke = vi.mocked(supabase.functions.invoke)
type InvokeResult = Awaited<ReturnType<typeof supabase.functions.invoke>>

/** Mô phỏng `functions.invoke` khi function trả HTTP lỗi: FunctionsHttpError mang Response ở `context`. */
function httpError(status: number, body: unknown): InvokeResult {
  const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    name: 'FunctionsHttpError',
    context: new Response(JSON.stringify(body), { status }),
  })
  return { data: null, error } as unknown as InvokeResult
}
const ok = (data: unknown) => ({ data, error: null }) as unknown as InvokeResult

const TX_ID = '11111111-1111-4111-8111-111111111111'
const TX = { amount: -5000, transactionDate: '2026-10-30T10:00:00+07:00', accountId: 'acc-1' }

beforeEach(() => {
  invoke.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('resolveUnparsed (qua edge function resolve-unparsed)', () => {
  it('gửi message_id / kind / tx snake_case, trả transaction_id', async () => {
    invoke.mockResolvedValue(ok({ transaction_id: TX_ID }))
    expect(await resolveUnparsed('m1', 'normal', TX)).toBe(TX_ID)
    expect(invoke).toHaveBeenCalledWith('resolve-unparsed', { body: {
      message_id: 'm1', kind: 'normal',
      tx: { amount: -5000, transaction_date: '2026-10-30T10:00:00+07:00', description: null, merchant_name: null, account_id: 'acc-1', card_id: null },
    } })
  })

  it('card_reminder / promo: tx null, trả null', async () => {
    invoke.mockResolvedValue(ok({ transaction_id: null }))
    expect(await resolveUnparsed('m2', 'promo')).toBeNull()
    expect(invoke).toHaveBeenCalledWith('resolve-unparsed', { body: { message_id: 'm2', kind: 'promo', tx: null } })
  })

  it('hết credit (402) -> ApiError insufficient_credit với thông điệp nạp thêm', async () => {
    invoke.mockResolvedValue(httpError(402, { error: 'insufficient_credit' }))
    await expect(resolveUnparsed('m1', 'normal', TX)).rejects.toMatchObject({
      code: 'insufficient_credit', message: 'Hết credit — nạp thêm để phân loại.',
    })
  })

  it('khoá / không thấy / đã xử lý / TK bị xoá: mỗi mã có thông điệp riêng', async () => {
    for (const [code, text] of [
      ['suspended', 'khoá'], ['not_found', 'Không tìm thấy'], ['invalid_request', 'đã được xử lý'], ['account_gone', 'vừa bị xoá'],
    ] as const) {
      invoke.mockResolvedValue(httpError(400, { error: code }))
      await expect(resolveUnparsed('m1', 'normal', TX)).rejects.toMatchObject({ code, message: expect.stringContaining(text) })
    }
  })

  it('body lỗi không đọc được / invoke throw (mất mạng) -> internal_error thông điệp chung', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('x') } as unknown as InvokeResult)
    await expect(resolveUnparsed('m1', 'promo')).rejects.toMatchObject({ code: 'internal_error' })
    invoke.mockRejectedValue(new Error('network'))
    await expect(resolveUnparsed('m1', 'promo')).rejects.toMatchObject({ code: 'internal_error' })
  })

  it('response sai hình dạng -> invalid_response (không hiện ZodError)', async () => {
    invoke.mockResolvedValue(ok({ transaction_id: 'not-a-uuid' }))
    await expect(resolveUnparsed('m1', 'normal', TX)).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
