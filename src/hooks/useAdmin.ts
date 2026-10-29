import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  adjustAdminCredit, getAdminUser, listAdminOrders, listAdminUsers, listAudit, resolveAdminOrder, runAdminMutation,
} from '@/services/admin'
import { useAuth } from '@/hooks/useAuth'
import { isAdminSession } from '@/features/auth/mfa'
import type { AdminKey, AdminMutation, AdminUser } from '@/types/admin'
import type { AdminOrderFilters, OrderResolution } from '@/types/admin-orders'
import type { CreditLedgerEntry } from '@/types/credit'
import { QK } from './query-keys'

const ADMIN_KEY = QK.admin
const USERS_KEY = [...ADMIN_KEY, 'users'] as const
const AUDIT_KEY = [...ADMIN_KEY, 'audit'] as const
const ORDERS_KEY = [...ADMIN_KEY, 'orders'] as const
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

type Detail = { user: AdminUser; keys: AdminKey[]; ledger?: CreditLedgerEntry[] }

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
    ...old,
    user: fresh ?? old.user,
    keys: action === 'revoke_keys' ? old.keys.map((k) => (k.revokedAt ? k : { ...k, revokedAt: now })) : old.keys,
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

/**
 * Điều chỉnh credit. Như các thao tác khác: KHÔNG refetch `get_user` (ghi audit `view_user`) — chép user mới
 * từ danh sách vào cache chi tiết và thêm 1 dòng sổ cái tạm (id âm, chỉ để hiển thị tới lần mở sau).
 */
export function useAdjustCredit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { userId: string; delta: number; reason: string }) =>
      adjustAdminCredit(v.userId, v.delta, v.reason),
    onSuccess: async (_balance, v) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: USERS_KEY }),
        qc.invalidateQueries({ queryKey: AUDIT_KEY }),
      ])
      const fresh = qc.getQueryData<AdminUser[]>(USERS_KEY)?.find((u) => u.id === v.userId)
      const entry: CreditLedgerEntry = {
        id: -Date.now(), delta: v.delta, kind: 'adjust', createdAt: new Date().toISOString(),
      }
      qc.setQueryData<Detail>(userKey(v.userId), (old) => old && {
        ...old,
        user: fresh ?? old.user,
        ledger: [entry, ...(old.ledger ?? [])].slice(0, 20),
      })
      toast.success('Đã điều chỉnh credit')
    },
  })
}

/** Đơn thanh toán theo bộ lọc (filters nằm trong queryKey -> đổi lọc tự tải lại). Không refetch khi focus. */
export function useAdminOrders(filters: AdminOrderFilters) {
  return useQuery({
    queryKey: [...ORDERS_KEY, filters.status, filters.provider],
    queryFn: () => listAdminOrders(filters),
    ...ADMIN_QUERY_OPTIONS,
  })
}

/**
 * Xử lý tay đơn. Sau khi xong tải lại đơn + nhật ký + danh sách user (số dư đổi); KHÔNG gọi `get_user`
 * (ghi audit `view_user`). Lỗi `order_not_resolvable` (đơn vừa đổi trạng thái ở nơi khác) cũng tải lại đơn.
 */
export function useResolveOrder() {
  const qc = useQueryClient()
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ORDERS_KEY }),
    qc.invalidateQueries({ queryKey: AUDIT_KEY }),
    qc.invalidateQueries({ queryKey: USERS_KEY }),
  ])
  return useMutation({
    mutationFn: (v: { orderId: string; option: OrderResolution; reason: string }) =>
      resolveAdminOrder(v.orderId, v.option, v.reason),
    onSuccess: async (r) => {
      await refresh()
      toast.success(r.status === 'paid' ? `Đã đánh dấu đã thanh toán (+${r.credits} credit)` : 'Đã đánh dấu thất bại')
    },
    onError: () => refresh(),
  })
}
