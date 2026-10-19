import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { updateCardTransactionMcc } from '@/services/creditCards'
import type { ApiError, PaginatedResponse } from '@/types/api'
import type { CreditCardTransaction } from '@/types/creditCard'

type TxPages = InfiniteData<PaginatedResponse<CreditCardTransaction>>
const KEY = ['creditCardTransactions']

/** MCC hiện có của giao dịch trong cache (cùng một giao dịch có cùng giá trị ở mọi bộ lọc). */
function readCachedMcc(qc: QueryClient, txId: string): string | undefined {
  for (const [, data] of qc.getQueriesData<TxPages>({ queryKey: KEY })) {
    const tx = data?.pages.flatMap((p) => p.data).find((t) => t.id === txId)
    if (tx) return tx.mcc
  }
  return undefined
}

/**
 * Ghi MCC của MỘT giao dịch vào mọi trang/bộ lọc đang cache. Chỉ đụng đúng dòng đó, nên hoàn
 * tác khi lỗi cũng chỉ chạm dòng đó: khôi phục cả ảnh chụp cache sẽ xoá luôn thay đổi lạc quan
 * của một lần sửa khác đang chạy song song.
 */
function patchCachedMcc(qc: QueryClient, txId: string, mcc: string | null) {
  qc.setQueriesData<TxPages>({ queryKey: KEY }, (old) =>
    old && {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        data: page.data.map((tx) => (tx.id === txId ? { ...tx, mcc: mcc ?? undefined } : tx)),
      })),
    }
  )
}

/** Gán / bỏ MCC của một giao dịch thẻ, cập nhật giao diện ngay (optimistic) và hoàn tác khi lỗi. */
export function useUpdateTransactionMcc() {
  const qc = useQueryClient()
  // Service ném object ApiError (không phải Error) nên phải khai báo kiểu lỗi.
  return useMutation<
    void, ApiError, { txId: string; mcc: string | null }, { previousMcc: string | undefined }
  >({
    mutationFn: ({ txId, mcc }) => updateCardTransactionMcc(txId, mcc),
    onMutate: async ({ txId, mcc }) => {
      // Chặn refetch đang bay ghi đè giá trị optimistic bằng dữ liệu cũ.
      await qc.cancelQueries({ queryKey: KEY })
      const previousMcc = readCachedMcc(qc, txId)
      patchCachedMcc(qc, txId, mcc)
      return { previousMcc }
    },
    onError: (err, { txId }, ctx) => {
      patchCachedMcc(qc, txId, ctx?.previousMcc ?? null)
      toast.error(err.message ?? 'Không lưu được MCC. Vui lòng thử lại.')
    },
    // KHÔNG trả về promise: trả về thì mutation vẫn `isPending` cho tới khi refetch xong MỌI
    // trang đã tải (20 dòng/trang, 100 dòng = 5 request tuần tự). Đồng bộ lại chạy nền, giá
    // trị lạc quan vẫn hiển thị trong lúc đó.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      // MCC quyết định giao dịch thuộc rule nào -> hoàn tiền ước tính của chu kỳ phải tính lại.
      void qc.invalidateQueries({ queryKey: ['cardCycleExpenses'] })
    },
  })
}
