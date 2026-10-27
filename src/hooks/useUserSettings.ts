import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getUserSettings, updateOwnerNames } from '@/services/user-settings'
import { deleteMyAccount } from '@/services/account-deletion'
import { queryClient } from '@/lib/query-client'

const USER_SETTINGS_KEY = ['userSettings'] as const

export function useUserSettings() {
  return useQuery({ queryKey: USER_SETTINGS_KEY, queryFn: getUserSettings })
}

export function useUpdateOwnerNames() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (names: string[]) => updateOwnerNames(names),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: USER_SETTINGS_KEY })
      toast.success('Đã lưu tên chủ tài khoản')
    },
  })
}

/**
 * Xoá tài khoản (service tự đăng xuất cục bộ), rồi xoá cache như nút đăng xuất ở
 * AppHeader để không lộ dữ liệu cũ cho phiên sau. ProtectedRoute tự đưa về /login.
 */
export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      queryClient.clear()
      toast.success('Đã xoá tài khoản và toàn bộ dữ liệu')
    },
  })
}
