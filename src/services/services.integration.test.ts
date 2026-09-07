import { describe, it, expect } from 'vitest'
import { getAccounts, getTransactions, getUnlinkedCount } from './accounts'
import { getCreditCards, getCreditCardTransactions } from './creditCards'
import { getDashboardStats } from './dashboard'
import { exportTransactions } from './exports'

// Số liệu kỳ vọng khớp comment cuối supabase/seed.sql
const LPBANK_ACCOUNT = '00000000-0000-4000-b000-000000000001'
const SHB_CARD = '00000000-0000-4000-c000-000000000001'
const VPBANK_CARD = '00000000-0000-4000-c000-000000000002'

describe('accounts service', () => {
  it('trả về 2 tài khoản của user, map đúng camelCase', async () => {
    const res = await getAccounts()
    expect(res.total).toBe(2)
    const lp = res.data.find((a) => a.bankName === 'LPBank')!
    expect(lp.accountNumber).toBe('****x265')
    expect(lp.accountType).toBe('checking')
    expect(lp.balance).toBe(5000000)
    expect(typeof lp.balance).toBe('number') // bigint không được rò ra dạng string
  })

  it('trả về giao dịch của tài khoản, sort mới nhất trước', async () => {
    const res = await getTransactions(LPBANK_ACCOUNT)
    expect(res.total).toBe(3)
    expect(res.data).toHaveLength(3)
    const dates = res.data.map((t) => t.transactionDate)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('suy đúng type từ dấu của amount', async () => {
    const res = await getTransactions(LPBANK_ACCOUNT)
    const income = res.data.find((t) => t.amount > 0)!
    const expense = res.data.find((t) => t.amount < 0)!
    expect(income.type).toBe('income')
    expect(expense.type).toBe('expense')
  })
})

describe('transaction filters', () => {
  it('txType=income chỉ trả tiền vào', async () => {
    const res = await getTransactions(LPBANK_ACCOUNT, undefined, 20, { txType: 'income' })
    expect(res.data).toHaveLength(1)
    expect(res.data[0].amount).toBe(10000000)
  })

  it('txType=expense chỉ trả tiền ra', async () => {
    const res = await getTransactions(LPBANK_ACCOUNT, undefined, 20, { txType: 'expense' })
    expect(res.data).toHaveLength(2)
    expect(res.data.every((t) => t.amount < 0)).toBe(true)
  })

  it('lọc theo khoảng ngày', async () => {
    const res = await getTransactions(LPBANK_ACCOUNT, undefined, 20, {
      dateFrom: '2026-09-01T00:00:00+07:00',
      dateTo: '2026-09-30T23:59:59+07:00',
    })
    expect(res.data).toHaveLength(2) // loại giao dịch tháng 8
  })

  it('search khớp cả description lẫn merchant_name', async () => {
    const res = await getTransactions(LPBANK_ACCOUNT, undefined, 20, { search: 'Highlands' })
    expect(res.data).toHaveLength(1)
    expect(res.data[0].merchantName).toBe('Highlands Coffee')
  })

  it('search có ký tự phá cú pháp PostgREST không làm vỡ query', async () => {
    // Nếu không sanitize, các ký tự này phá filter .or() -> throw
    for (const q of ['a,b', 'x)', '(y', '100%', 'a_b', "o'brien", '*']) {
      await expect(getTransactions(LPBANK_ACCOUNT, undefined, 20, { search: q })).resolves.toBeDefined()
    }
  })

  it('payload injection không rò thêm row ngoài phạm vi account', async () => {
    // PostgREST truyền value dạng tham số, không nối chuỗi SQL, nên ';' và '--'
    // chỉ là text thường. Test này khoá lại kết luận đó (đã probe thực tế).
    // Cũng chặn cả cú pháp filter của PostgREST ('id.gt.0') bị nhúng qua search.
    for (const payload of [
      'Highlands; drop table transactions--',
      'Highlands--',
      'Highlands/**/or/**/1=1',
      "x' or '1'='1",
      'id.gt.0',
      'description.neq.zzz',
    ]) {
      const r = await getTransactions(LPBANK_ACCOUNT, undefined, 20, { search: payload })
      expect(r.data.length).toBeLessThanOrEqual(3) // tổng row của account này
    }
  })

  it('lọc theo category', async () => {
    const res = await getTransactions(LPBANK_ACCOUNT, undefined, 20, { category: 'Ăn uống' })
    expect(res.data).toHaveLength(1)
    expect(res.data[0].category).toBe('Ăn uống')
  })
})

describe('keyset pagination', () => {
  it('lật hết trang không lặp, không sót', async () => {
    const seen: string[] = []
    let cursor: string | undefined
    for (let page = 0; page < 5; page++) {
      const res = await getTransactions(LPBANK_ACCOUNT, cursor, 1)
      seen.push(...res.data.map((t) => t.id))
      if (!res.nextCursor) break
      cursor = res.nextCursor
    }
    expect(seen).toHaveLength(3)
    expect(new Set(seen).size).toBe(3) // không trùng id
  })
})

describe('getUnlinkedCount', () => {
  it('đếm giao dịch chưa link thẻ/TK (seed đã link hết -> 0)', async () => {
    // > 0 nghĩa là seed accounts/credit_cards chưa khớp account_ref mà parser bắt.
    // Những row đó KHÔNG hiện trong list nhưng VẪN được dashboard đếm.
    await expect(getUnlinkedCount()).resolves.toBe(0)
  })
})

describe('credit cards service', () => {
  it('trả về 2 thẻ, map đúng field', async () => {
    const res = await getCreditCards()
    expect(res.total).toBe(2)
    const shb = res.data.find((c) => c.bankName === 'SHB')!
    expect(shb.creditLimit).toBe(50000000)
    expect(shb.statementDate).toBe(15)
    expect(shb.paymentDueDate).toBe(5)
    expect(shb.cardType).toBe('mastercard')
  })

  it('trả về giao dịch của thẻ', async () => {
    const res = await getCreditCardTransactions(SHB_CARD)
    expect(res.total).toBe(2)
    expect(res.data.every((t) => t.type === 'purchase')).toBe(true)
  })

  it('tiền vào thẻ được map thành payment', async () => {
    const res = await getCreditCardTransactions(VPBANK_CARD)
    const payment = res.data.find((t) => t.amount > 0)!
    expect(payment.type).toBe('payment')
  })

  it('txType=income luôn rỗng (thẻ chỉ có chi tiêu)', async () => {
    const res = await getCreditCardTransactions(SHB_CARD, undefined, 20, { txType: 'income' })
    expect(res.data).toHaveLength(0)
    expect(res.total).toBe(0)
  })
})

describe('dashboard RPC', () => {
  it('tổng hợp khớp số liệu seed', async () => {
    const s = await getDashboardStats()
    expect(s.transactionCount).toBe(8)
    expect(s.totalIncome).toBe(19827000)
    expect(s.totalExpense).toBe(7718430)
    expect(s.bankIncome).toBe(14827000)
    expect(s.bankExpense).toBe(150430)
    expect(s.ccIncome).toBe(5000000)
    expect(s.ccExpense).toBe(7568000)
  })

  it('categoryBreakdown đúng từng nhóm', async () => {
    const s = await getDashboardStats()
    const byCat = Object.fromEntries(s.categoryBreakdown.map((c) => [c.category, c.amount]))
    expect(byCat['Ăn uống']).toBe(2157000)
    expect(byCat['Mua sắm']).toBe(500000)
    expect(byCat['Khác']).toBe(5061430)
  })

  it('lọc theo ngày làm đổi kết quả', async () => {
    const s = await getDashboardStats({
      dateFrom: '2026-09-01T00:00:00+07:00',
      dateTo: '2026-09-30T23:59:59+07:00',
    })
    expect(s.transactionCount).toBe(4) // 2 LPBank + 2 SHB trong tháng 9
  })
})

describe('exports service', () => {
  it('xuất giao dịch tài khoản, áp đúng filter', async () => {
    const all = await exportTransactions(LPBANK_ACCOUNT)
    expect(all.data).toHaveLength(3)
    const filtered = await exportTransactions(LPBANK_ACCOUNT, { txType: 'expense' })
    expect(filtered.data).toHaveLength(2)
  })

  it('xuất giao dịch thẻ qua cardId', async () => {
    const res = await exportTransactions(null, { cardId: SHB_CARD })
    expect(res.data).toHaveLength(2)
  })

  it('thiếu cả accountId lẫn cardId thì báo lỗi', async () => {
    await expect(exportTransactions(null, {})).rejects.toThrow()
  })
})
