import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))
vi.mock('@/services/credit-card-mutations', () => ({
  createCreditCard: vi.fn(), updateCreditCard: vi.fn(), deleteCreditCard: vi.fn(), countCardTransactions: vi.fn(),
}))
vi.mock('@/services/accounts', () => ({ getUnlinkedCount: vi.fn().mockResolvedValue(0) }))
vi.mock('@/services/account-mutations', () => ({
  createAccount: vi.fn(), updateAccount: vi.fn(), deleteAccount: vi.fn(), countAccountTransactions: vi.fn(),
}))
vi.mock('@/services/unparsed-messages', () => ({
  getUnparsedMessages: vi.fn(), getUnparsedCount: vi.fn(), resolveUnparsed: vi.fn(),
}))
vi.mock('@/services/creditCards', () => ({
  updateCardTransaction: vi.fn(), updateCardTransactionMcc: vi.fn(),
}))
vi.mock('@/services/cashbackRules', () => ({
  listCashbackRules: vi.fn(), createCashbackRule: vi.fn(), updateCashbackRule: vi.fn(),
  deleteCashbackRule: vi.fn(), setCardCashbackCap: vi.fn(), getCycleExpenses: vi.fn(),
}))

import { createCreditCard, updateCreditCard, deleteCreditCard } from '@/services/credit-card-mutations'
import { createAccount, updateAccount, deleteAccount } from '@/services/account-mutations'
import { resolveUnparsed } from '@/services/unparsed-messages'
import { updateCardTransaction } from '@/services/creditCards'
import {
  createCashbackRule, updateCashbackRule, deleteCashbackRule, setCardCashbackCap,
} from '@/services/cashbackRules'
import { useCreateCreditCard, useUpdateCreditCard, useDeleteCreditCard } from './useCreditCardMutations'
import { useCreateAccount, useUpdateAccount, useDeleteAccount } from './useAccountMutations'
import { useResolveUnparsed } from './useUnparsedMessages'
import { useUpdateCardTransaction } from './useUpdateCardTransaction'
import {
  useSaveCashbackRule, useDeleteCashbackRule, useSetCardCashbackCap,
} from './useCashbackRules'
import type { CardFormValues } from '@/types/credit-card-form'
import type { AccountFormValues } from '@/types/account-form'
import type { CreditCard } from '@/types/creditCard'
import type { BankAccount } from '@/types/account'

/** Chạy hook với QueryClient thật, trả về các queryKey đã invalidate (đúng thứ tự gọi). */
function setup<T>(useHook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const spy = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  const hook = renderHook(useHook, { wrapper })
  const keys = () => spy.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)
  return { hook, keys }
}

const CARD_SET = [
  ['creditCards'], ['creditCardTransactions'], ['dashboardStats'], ['cashbackRules'], ['cardCycleExpenses'],
]
const ACCOUNT_SET = [['accounts'], ['transactions'], ['dashboardStats']]

const cardValues = { bankName: 'A', cardNumber: '****1234' } as unknown as CardFormValues
const card = { id: 'c1', bankName: 'A', cardNumber: '****1234' } as unknown as CreditCard
const accValues = {} as unknown as AccountFormValues
const account = { id: 'a1' } as unknown as BankAccount

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createCreditCard).mockResolvedValue(undefined as never)
  vi.mocked(updateCreditCard).mockResolvedValue(undefined as never)
  vi.mocked(deleteCreditCard).mockResolvedValue(3 as never)
  vi.mocked(createAccount).mockResolvedValue(undefined as never)
  vi.mocked(updateAccount).mockResolvedValue(undefined as never)
  vi.mocked(deleteAccount).mockResolvedValue(2 as never)
  vi.mocked(updateCardTransaction).mockResolvedValue(undefined)
  vi.mocked(createCashbackRule).mockResolvedValue(undefined as never)
  vi.mocked(updateCashbackRule).mockResolvedValue(undefined as never)
  vi.mocked(deleteCashbackRule).mockResolvedValue(undefined as never)
  vi.mocked(setCardCashbackCap).mockResolvedValue(undefined as never)
})

describe('invalidation: thẻ', () => {
  it.each([
    ['create', () => useCreateCreditCard(), (h: ReturnType<typeof useCreateCreditCard>) => h.mutateAsync(cardValues)],
    ['update', () => useUpdateCreditCard(card), (h: ReturnType<typeof useUpdateCreditCard>) => h.mutateAsync(cardValues)],
    ['delete', () => useDeleteCreditCard(), (h: ReturnType<typeof useDeleteCreditCard>) => h.mutateAsync('c1')],
  ] as const)('%s tải lại đúng 5 nhóm cache', async (_n, hookFn, run) => {
    const { hook, keys } = setup(hookFn as () => never)
    await act(async () => { await (run as (h: unknown) => Promise<unknown>)(hook.result.current) })
    await waitFor(() => expect(keys()).toEqual(CARD_SET))
  })
})

describe('invalidation: tài khoản', () => {
  it.each([
    ['create', () => useCreateAccount(), (h: ReturnType<typeof useCreateAccount>) => h.mutateAsync(accValues)],
    ['update', () => useUpdateAccount(account), (h: ReturnType<typeof useUpdateAccount>) => h.mutateAsync(accValues)],
    ['delete', () => useDeleteAccount(), (h: ReturnType<typeof useDeleteAccount>) => h.mutateAsync('a1')],
  ] as const)('%s tải lại đúng 3 nhóm cache', async (_n, hookFn, run) => {
    const { hook, keys } = setup(hookFn as () => never)
    await act(async () => { await (run as (h: unknown) => Promise<unknown>)(hook.result.current) })
    await waitFor(() => expect(keys()).toEqual(ACCOUNT_SET))
  })
})

describe('invalidation: hộp tin chưa phân loại', () => {
  it('resolve tạo giao dịch -> hộp tin + 4 nhóm dẫn xuất', async () => {
    vi.mocked(resolveUnparsed).mockResolvedValue('tx1')
    const { hook, keys } = setup(useResolveUnparsed)
    await act(async () => { await hook.result.current.mutateAsync({ messageId: 'm', kind: 'normal' }) })
    expect(keys()).toEqual([
      ['unparsedMessages'], ['transactions'], ['creditCardTransactions'], ['dashboardStats'], ['cardCycleExpenses'],
    ])
  })

  it('resolve không tạo giao dịch (promo) -> chỉ hộp tin', async () => {
    vi.mocked(resolveUnparsed).mockResolvedValue(null)
    const { hook, keys } = setup(useResolveUnparsed)
    await act(async () => { await hook.result.current.mutateAsync({ messageId: 'm', kind: 'promo' }) })
    expect(keys()).toEqual([['unparsedMessages']])
  })

  it('resolve lỗi -> vẫn tải lại hộp tin', async () => {
    vi.mocked(resolveUnparsed).mockRejectedValue(new Error('đã xử lý'))
    const { hook, keys } = setup(useResolveUnparsed)
    await act(async () => { await hook.result.current.mutateAsync({ messageId: 'm', kind: 'promo' }).catch(() => {}) })
    expect(keys()).toEqual([['unparsedMessages']])
  })
})

describe('invalidation: sửa giao dịch thẻ', () => {
  it('tải lại giao dịch thẻ, chi tiêu chu kỳ, dashboard', async () => {
    const { hook, keys } = setup(useUpdateCardTransaction)
    await act(async () => { await hook.result.current.mutateAsync({ txId: 't', patch: {} }) })
    expect(keys()).toEqual([['creditCardTransactions'], ['cardCycleExpenses'], ['dashboardStats']])
  })
})

describe('invalidation: rule hoàn tiền', () => {
  it('thêm/sửa rule chỉ tải lại rule của thẻ đó', async () => {
    const add = setup(() => useSaveCashbackRule('c1'))
    await act(async () => { await add.hook.result.current.mutateAsync({ ruleId: null, values: {} as never }) })
    expect(add.keys()).toEqual([['cashbackRules', 'c1']])

    const edit = setup(() => useSaveCashbackRule('c1'))
    await act(async () => { await edit.hook.result.current.mutateAsync({ ruleId: 'r1', values: {} as never }) })
    expect(edit.keys()).toEqual([['cashbackRules', 'c1']])
  })

  it('xoá rule chỉ tải lại rule của thẻ đó', async () => {
    const { hook, keys } = setup(() => useDeleteCashbackRule('c1'))
    await act(async () => { await hook.result.current.mutateAsync('r1') })
    expect(keys()).toEqual([['cashbackRules', 'c1']])
  })

  it('đặt trần thẻ tải lại danh sách thẻ', async () => {
    const { hook, keys } = setup(() => useSetCardCashbackCap('c1'))
    await act(async () => { await hook.result.current.mutateAsync(1000) })
    expect(keys()).toEqual([['creditCards']])
  })
})
