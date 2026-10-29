import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPayment, getOrder, getProviders, listOrders, listPackages, refreshOrder } from '@/services/payments'
import { isFinalStatus, PAYMENT_POLL_MAX_MS, type PaymentProvider } from '@/types/payment'
import { QK } from './query-keys'
import { useNow } from './useNow'

const PAYMENTS = ['payments'] as const
const POLL_MS = 3000
/** Server cũng chặn (15s/đơn); chặn ở client để khỏi gọi function mỗi 3s. */
const REFRESH_EVERY_MS = 15_000

export function usePackages() {
  return useQuery({ queryKey: [...PAYMENTS, 'packages'], queryFn: listPackages, staleTime: 5 * 60_000 })
}

/** Ví đang bật. Lỗi -> UI báo, không đoán "ví nào cũng bật". */
export function useProviders(enabled = true) {
  return useQuery({ queryKey: [...PAYMENTS, 'providers'], queryFn: getProviders, enabled, staleTime: 60_000 })
}

export function usePaymentOrders() {
  return useQuery({ queryKey: [...PAYMENTS, 'orders'], queryFn: () => listOrders() })
}

/** Không invalidate gì ở đây: sau khi tạo đơn trang chuyển sang ví; về lại sẽ tải mới. */
export function useCreatePayment() {
  return useMutation({ mutationFn: ({ provider, packageId }: { provider: PaymentProvider; packageId: string }) => createPayment(provider, packageId) })
}

/** Đơn paid thì replay đã ghi giao dịch treo + đổi số dư: tải lại mọi thứ bị ảnh hưởng. */
function useInvalidateOnPaid(status: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (status !== 'paid') return
    for (const key of [QK.credits, QK.unparsedMessages, QK.transactions, QK.creditCardTransactions, QK.dashboardStats, PAYMENTS]) {
      void qc.invalidateQueries({ queryKey: key })
    }
  }, [status, qc])
}

/**
 * Theo dõi 1 đơn trên trang return: đọc DB mỗi 3s khi còn pending; cứ ≥ 15s nhờ server hỏi provider (IPN có thể mất).
 * Dừng khi đơn ở trạng thái cuối hoặc sau PAYMENT_POLL_MAX_MS.
 */
export function usePaymentOrder(orderId: string | null) {
  const [startedAt] = useState(() => Date.now())
  const now = useNow(30_000)
  const lastRefresh = useRef(0)
  const query = useQuery({
    queryKey: [...PAYMENTS, 'order', orderId],
    enabled: Boolean(orderId),
    queryFn: async () => {
      let order = await getOrder(orderId as string)
      if (order?.status === 'pending' && Date.now() - lastRefresh.current >= REFRESH_EVERY_MS) {
        lastRefresh.current = Date.now()
        // Lỗi refresh (mạng, provider) không làm hỏng việc xem trạng thái: lần poll sau thử lại.
        const status = await refreshOrder(order.id).catch(() => null)
        if (status && status !== order.status) order = await getOrder(order.id)
      }
      return order
    },
    refetchInterval: (q) => {
      const order = q.state.data
      if (!order || isFinalStatus(order.status)) return false
      return Date.now() - startedAt < PAYMENT_POLL_MAX_MS ? POLL_MS : false
    },
  })
  useInvalidateOnPaid(query.data?.status)
  return { ...query, timedOut: query.data?.status === 'pending' && Date.parse(now) - startedAt >= PAYMENT_POLL_MAX_MS }
}
