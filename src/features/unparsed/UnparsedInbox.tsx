import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useResolveUnparsed, useUnparsedMessages } from '@/hooks/useUnparsedMessages'
import { UNPARSED_PAGE_LIMIT } from '@/services/unparsed-messages'
import type { ApiError } from '@/types/api'
import type { UnparsedMessage } from '@/types/unparsed'
import { toast } from 'sonner'
import { ResolveUnparsedDialog } from './ResolveUnparsedDialog'
import { UnparsedMessageItem } from './UnparsedMessageItem'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { CheckCheck } from 'lucide-react'

/**
 * Thông báo ngân hàng mà parser chưa đọc được. User ghi thành giao dịch, hoặc đánh dấu
 * nhắc thẻ / quảng cáo để tin rời khỏi hộp. Tin đã xử lý không hoàn tác được (DB chặn).
 */
export function UnparsedInbox() {
  const [includePromo, setIncludePromo] = useState(false)
  const { data, isLoading, isError, refetch } = useUnparsedMessages(includePromo)
  const resolve = useResolveUnparsed()
  const [recording, setRecording] = useState<UnparsedMessage | null>(null)

  const messages = data?.data ?? []

  function mark(message: UnparsedMessage, kind: 'card_reminder' | 'promo') {
    // Không hoàn tác được (DB khoá tin đã xử lý) — bấm nhầm là mất giao dịch khỏi hộp.
    const label = kind === 'promo' ? 'quảng cáo (bỏ qua)' : 'nhắc thanh toán thẻ'
    if (!window.confirm(`Đánh dấu tin này là ${label}? Tin sẽ rời khỏi hộp và không hoàn tác được.`)) return
    resolve.mutate(
      { messageId: message.id, kind },
      { onError: (err) => toast.error((err as unknown as ApiError).message ?? 'Không cập nhật được tin.') },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Thông báo ngân hàng chưa tự đọc được. Ghi thành giao dịch hoặc bỏ qua.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox" checked={includePromo}
            onChange={(e) => setIncludePromo(e.target.checked)}
          />
          Hiện cả tin quảng cáo
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-lg border border-destructive/40 p-8 text-center">
          <p className="font-medium">Không tải được hộp tin</p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>Thử lại</Button>
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          bordered tone="success" icon={CheckCheck}
          title="Không còn tin nào cần phân loại"
          description="Thông báo mới mà hệ thống chưa đọc được sẽ hiện ở đây."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {messages.map((m) => (
              <UnparsedMessageItem
                key={m.id} message={m} disabled={resolve.isPending}
                onRecord={() => setRecording(m)} onMark={(kind) => mark(m, kind)}
              />
            ))}
          </ul>
          {(data?.total ?? 0) > messages.length && (
            <p className="text-center text-xs text-muted-foreground">
              Đang hiện {UNPARSED_PAGE_LIMIT} tin mới nhất trên tổng {data?.total}. Xử lý bớt để xem tin cũ hơn.
            </p>
          )}
        </>
      )}

      <ResolveUnparsedDialog message={recording} onOpenChange={(open) => { if (!open) setRecording(null) }} />
    </div>
  )
}
