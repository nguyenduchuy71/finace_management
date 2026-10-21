import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getUnparsedCount, getUnparsedMessages, resolveUnparsed } from './unparsed-messages'
import { createAccount, deleteAccount, updateAccount, countAccountTransactions } from './account-mutations'
import { getTransactions } from './accounts'
import { getDashboardStats } from './dashboard'
import type { AccountFormValues } from '@/types/account-form'

// Migration 20261021100000: hộp tin chưa phân loại, transactions.kind, CRUD tài khoản.
// Dùng chung DB với services.integration.test.ts (assert tổng cố định theo seed) -> dọn
// sạch mọi thứ tạo ra, kể cả khi lần chạy trước crash. Ca chéo 2 user: supabase/tests/
// unparsed-accounts-rls.sql.
//
// Client không có quyền insert unparsed_messages (chỉ edge function, service_role) -> seed
// bằng service_role key của Supabase LOCAL (VITE_TEST_SERVICE_ROLE_KEY trong .env.test.local,
// lấy từ `supabase status -o env`). integration-setup.ts đã chặn URL không phải local.

const serviceKey = import.meta.env.VITE_TEST_SERVICE_ROLE_KEY as string | undefined
if (!serviceKey) {
  throw new Error(
    'Thiếu VITE_TEST_SERVICE_ROLE_KEY trong .env.test.local (SERVICE_ROLE_KEY của `supabase status -o env`).'
  )
}
const admin = createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const MARK = 'ITEST-UNPARSED:'
const ACCOUNT: AccountFormValues = {
  bankName: 'TestBank', accountName: 'TK test hộp tin', accountNumber: '****t001',
  accountType: 'checking', balance: 0,
}
// Ngày cố định, xa dữ liệu seed, để tổng dashboard theo khoảng chỉ gồm giao dịch của file này.
const DAY = { dateFrom: '2031-03-01T00:00:00.000Z', dateTo: '2031-03-01T23:59:59.999Z' }

let userId = ''
let accountId = ''
const msg: Record<'tx' | 'internal' | 'promo' | 'reminder', string> = { tx: '', internal: '', promo: '', reminder: '' }

async function seedMessage(text: string, suggested: string) {
  const { data, error } = await admin
    .from('unparsed_messages')
    .insert({ user_id: userId, raw_text: MARK + text, suggested_kind: suggested, reason: 'no_match' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function cleanup() {
  const { data: accounts } = await supabase
    .from('accounts').select('id').eq('bank_name', ACCOUNT.bankName)
  // Xoá TK qua RPC -> giao dịch đi kèm bị xoá theo; tin liên kết về transaction_id null.
  for (const a of accounts ?? []) await deleteAccount(a.id)
  await admin.from('unparsed_messages').delete().like('raw_text', `${MARK}%`)
}

beforeAll(async () => {
  const { data } = await supabase.auth.getUser()
  userId = data.user!.id
  await cleanup()
  accountId = (await createAccount(ACCOUNT)).id
  msg.tx = await seedMessage('-84,000 VND Tài khoản: ****t001', 'transaction')
  msg.internal = await seedMessage('+500,000 VND Tài khoản: ****t001 NGUYEN VAN AN chuyen tien', 'transaction')
  msg.promo = await seedMessage('🎁 Ưu đãi hoàn tiền 50%', 'promo')
  msg.reminder = await seedMessage('Tong du no: 1,219,710 VND', 'card_reminder')
})

afterAll(cleanup)

const mine = (ids: string[]) => ids.filter((id) => Object.values(msg).includes(id))

describe('hộp tin chưa phân loại', () => {
  it('mặc định ẩn quảng cáo; includePromo hiện cả quảng cáo', async () => {
    const visible = mine((await getUnparsedMessages()).data.map((m) => m.id))
    expect(visible.sort()).toEqual([msg.tx, msg.internal, msg.reminder].sort())
    const all = mine((await getUnparsedMessages(true)).data.map((m) => m.id))
    expect(all).toContain(msg.promo)
  })

  it('đếm cho badge không tính quảng cáo', async () => {
    const before = await getUnparsedCount()
    const { data } = await getUnparsedMessages()
    expect(before).toBe(data.length)
  })

  it('resolve normal tạo giao dịch trong TK, dashboard tính vào chi', async () => {
    const before = await getDashboardStats(DAY)
    const txId = await resolveUnparsed(msg.tx, 'normal', {
      amount: -84000, transactionDate: '2031-03-01T09:00:00+07:00', description: 'chuyển khoản', accountId,
    })
    expect(txId).toMatch(/^[0-9a-f-]{36}$/)

    const list = await getTransactions(accountId)
    const tx = list.data.find((t) => t.id === txId)
    expect(tx).toMatchObject({ amount: -84000, kind: 'normal', description: 'chuyển khoản' })

    const after = await getDashboardStats(DAY)
    expect(after.totalExpense - before.totalExpense).toBe(84000)
    expect(mine((await getUnparsedMessages()).data.map((m) => m.id))).not.toContain(msg.tx)
  })

  it('resolve internal_transfer tạo giao dịch nhưng dashboard KHÔNG đổi', async () => {
    const before = await getDashboardStats(DAY)
    const txId = await resolveUnparsed(msg.internal, 'internal_transfer', {
      amount: 500000, transactionDate: '2031-03-01T10:00:00+07:00', accountId,
    })
    const tx = (await getTransactions(accountId)).data.find((t) => t.id === txId)
    expect(tx?.kind).toBe('internal_transfer')
    const after = await getDashboardStats(DAY)
    expect(after.totalIncome).toBe(before.totalIncome)
    expect(after.transactionCount).toBe(before.transactionCount)
  })

  it('đánh dấu nhắc thẻ / quảng cáo không tạo giao dịch', async () => {
    expect(await resolveUnparsed(msg.reminder, 'card_reminder')).toBeNull()
    expect(await resolveUnparsed(msg.promo, 'promo')).toBeNull()
    expect(mine((await getUnparsedMessages(true)).data.map((m) => m.id))).toEqual([])
    expect(await countAccountTransactions(accountId)).toBe(2)
  })

  it('xử lý lại tin đã xử lý -> lỗi thân thiện, không tạo giao dịch thứ hai', async () => {
    await expect(resolveUnparsed(msg.tx, 'normal', {
      amount: -84000, transactionDate: '2031-03-01T09:00:00+07:00', accountId,
    })).rejects.toMatchObject({ code: '22023', message: expect.stringContaining('đã được xử lý') })
    expect(await countAccountTransactions(accountId)).toBe(2)
  })
})

describe('CRUD tài khoản', () => {
  it('trùng ngân hàng + số TK -> 23505 với thông điệp riêng', async () => {
    await expect(createAccount(ACCOUNT)).rejects.toMatchObject({
      code: '23505', message: expect.stringContaining('đã có'),
    })
  })

  it('số TK sai mask bị DB chặn dù lách form -> 23514', async () => {
    await expect(createAccount({ ...ACCOUNT, accountNumber: '0349360265' })).rejects.toMatchObject({ code: '23514' })
  })

  it('cập nhật tên và số dư', async () => {
    const updated = await updateAccount(accountId, { ...ACCOUNT, accountName: 'Đã đổi tên', balance: 123000 })
    expect(updated).toMatchObject({ accountName: 'Đã đổi tên', balance: 123000 })
  })

  it('xoá TK kèm toàn bộ giao dịch, trả số giao dịch đã xoá', async () => {
    expect(await deleteAccount(accountId)).toBe(2)
    await expect(deleteAccount(accountId)).rejects.toMatchObject({ code: 'P0002' })
  })
})
