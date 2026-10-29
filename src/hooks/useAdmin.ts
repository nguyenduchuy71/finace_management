import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getAdminUser, listAdminUsers, listAudit, runAdminMutation } from '@/services/admin'
import { useAuth } from '@/hooks/useAuth'
import { isAdminSession } from '@/features/auth/mfa'
import type { AdminKey, AdminMutation, AdminUser } from '@/types/admin'
import { QK } from './query-keys'

const ADMIN_KEY = QK.admin
const USERS_KEY = [...ADMIN_KEY, 'users'] as const
const AUDIT_KEY = [...ADMIN_KEY, 'audit'] as const
const userKey = (id: string | null) => [...ADMIN_KEY, 'user', id] as const

/** Chỉ để ẩn/hiện UI — quyền thật kiểm ở function `admin`. */
export function useIsAdmin(): boolean {
  return isAdminSession(useAuth().session)
}

/**
 * Không tự refetch khi quay lại tab: `get_user` ghi audit `view_user` mỗi lần gọi, refetch tự động
 * làm audit đầy dòng không phải do admin chủ động xem. Lỗi MFA không retry (retry vô ích).
 */
const ADMIN_QUERY_OPTIONS = { refetchOnWindowFocus: false, retry: false, staleTime: 60_000 } as const

export function useAdminUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: listAdminUsers, ...ADMIN_QUERY_OPTIONS })
}

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: userKey(userId),
    queryFn: () => getAdminUser(userId!),
    enabled: userId !== null,
    ...ADMIN_QUERY_OPTIONS,
  })
}

export function useAdminAudit() {
  return useQuery({ queryKey: AUDIT_KEY, queryFn: listAudit, ...ADMIN_QUERY_OPTIONS })
}

const DONE: Record<AdminMutation, string> = {
  suspend: 'Đã khoá user',
  unsuspend: 'Đã mở khoá user',
  revoke_keys: 'Đã thu hồi mọi key của user',
}

type Detail = { user: AdminUser; keys: AdminKey[] }

/**
 * Sau thao tác: tải lại danh sách + nhật ký, rồi CHÉP dòng mới của user vào cache chi tiết thay vì
 * refetch `get_user` — mỗi lần get_user ghi 1 dòng audit `view_user`, refetch tự động sẽ ghi thừa.
 * Key thu hồi được đánh dấu tại chỗ (chi tiết key chỉ đổi qua revoke_keys).
 */
async function refreshAfterMutation(qc: ReturnType<typeof useQueryClient>, action: AdminMutation, userId: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: USERS_KEY }),
    qc.invalidateQueries({ queryKey: AUDIT_KEY }),
  ])
  const fresh = qc.getQueryData<AdminUser[]>(USERS_KEY)?.find((u) => u.id === userId)
  const now = new Date().toISOString()
  qc.setQueryData<Detail>(userKey(userId), (old) => old && {
    user: fresh ?? old.user,
    keys: action === 'revoke_keys' ? old.keys.map((k) => (k.revoked_at ? k : { ...k, revoked_at: now })) : old.keys,
  })
}

export function useAdminMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { action: AdminMutation; userId: string; reason: string }) =>
      runAdminMutation(v.action, v.userId, v.reason),
    onSuccess: async (_data, v) => {
      await refreshAfterMutation(qc, v.action, v.userId)
      toast.success(DONE[v.action])
    },
    // ban_failed: DB đã khoá nhưng GoTrue chưa — làm mới để thấy trạng thái lệch.
    onError: (_e, v) => refreshAfterMutation(qc, v.action, v.userId),
  })
}
