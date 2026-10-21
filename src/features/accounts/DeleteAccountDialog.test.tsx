import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/account-mutations', () => ({
  createAccount: vi.fn(), updateAccount: vi.fn(), deleteAccount: vi.fn(), countAccountTransactions: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { countAccountTransactions, deleteAccount } from '@/services/account-mutations'
import { useFilterStore } from '@/stores/filterStore'
import { mockAccounts } from '@/test/fixtures/accounts'
import { DeleteAccountDialog } from './DeleteAccountDialog'

const account = mockAccounts[0]

function renderDialog() {
  const onOpenChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  render(<DeleteAccountDialog open account={account} onOpenChange={onOpenChange} />, { wrapper })
  return { onOpenChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  useFilterStore.setState({ accountId: account.id })
  vi.mocked(countAccountTransactions).mockResolvedValue(7)
  vi.mocked(deleteAccount).mockResolvedValue(7)
})

describe('DeleteAccountDialog', () => {
  it('nói rõ số giao dịch sẽ mất; chỉ cho xoá khi gõ đúng tên TK', async () => {
    const { onOpenChange } = renderDialog()
    expect(await screen.findByText('7')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: 'Xoá tài khoản và giao dịch' })
    expect(btn).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Gõ lại tên tài khoản/), { target: { value: 'sai tên' } })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Gõ lại tên tài khoản/), { target: { value: account.accountName } })
    expect(btn).toBeEnabled()

    fireEvent.click(btn)
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith(account.id))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(useFilterStore.getState().accountId).toBeNull()
  })

  it('không đếm được giao dịch -> không cho xoá', async () => {
    vi.mocked(countAccountTransactions).mockRejectedValue({ code: 'X', message: 'lỗi' })
    renderDialog()
    expect(await screen.findByText(/Không đếm được số giao dịch/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Gõ lại tên tài khoản/), { target: { value: account.accountName } })
    expect(screen.getByRole('button', { name: 'Xoá tài khoản và giao dịch' })).toBeDisabled()
  })
})
