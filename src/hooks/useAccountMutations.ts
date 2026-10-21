import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createAccount, updateAccount, deleteAccount, countAccountTransactions,
} from '@/services/account-mutations'
import type { AccountFormValues } from '@/types/account-form'
import type { BankAccount } from '@/types/account'

/** Đổi TK làm thay đổi danh sách TK, giao dịch của TK, dashboard và hộp tin (nguồn tiền). */
function useInvalidateAccountData() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['accounts'] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['dashboardStats'] }),
    ])
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccountData()
  return useMutation({
    mutationFn: (values: AccountFormValues) => createAccount(values),
    onSuccess: async () => {
      await invalidate()
      toast.success('Đã thêm tài khoản')
    },
  })
}

export function useUpdateAccount(account: BankAccount | null) {
  const invalidate = useInvalidateAccountData()
  return useMutation({
    mutationFn: (values: AccountFormValues) => {
      if (!account) throw new Error('Không có tài khoản để cập nhật')
      return updateAccount(account.id, values)
    },
    onSuccess: async () => {
      await invalidate()
      toast.success('Đã cập nhật tài khoản')
    },
  })
}

export function useDeleteAccount() {
  const invalidate = useInvalidateAccountData()
  return useMutation({
    mutationFn: (accountId: string) => deleteAccount(accountId),
    onSuccess: async (deletedTx) => {
      await invalidate()
      toast.success(`Đã xoá tài khoản và ${deletedTx} giao dịch`)
    },
  })
}

/** Đếm giao dịch của TK để dialog xoá nói rõ sẽ mất bao nhiêu — luôn lấy mới. */
export function useAccountTransactionCount(accountId: string) {
  return useQuery({
    queryKey: ['accountTxCount', accountId],
    queryFn: () => countAccountTransactions(accountId),
    staleTime: 0,
    gcTime: 0,
  })
}
