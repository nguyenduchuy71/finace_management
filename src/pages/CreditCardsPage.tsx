import { useState } from 'react'
import { CreditCardSelector } from '@/features/creditCards/CreditCardSelector'
import { CreditCardTransactionList } from '@/features/creditCards/CreditCardTransactionList'
import { BillingCycleInfoCard } from '@/features/creditCards/BillingCycleInfoCard'
import { CardFormDialog } from '@/features/creditCards/CardFormDialog'
import { DeleteCardDialog } from '@/features/creditCards/DeleteCardDialog'
import { FilterBar } from '@/components/filters/FilterBar'
import { Button } from '@/components/ui/button'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useFilterStore } from '@/stores/filterStore'
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'

/** Form đang thêm thẻ mới, hoặc sửa một thẻ (theo id); null = đóng. */
type FormMode = { kind: 'create' } | { kind: 'edit'; cardId: string } | null

export function CreditCardsPage() {
  const { data: cardsData, isLoading, isError, refetch } = useCreditCards()
  const cardId = useFilterStore((s) => s.cardId)
  // useCreditCards uses useQuery — data is PaginatedResponse<CreditCard> directly
  const cards = cardsData?.data ?? []
  const card = cards.find((c) => c.id === cardId) ?? null

  // Lưu ID thay vì cờ boolean + "thẻ đang chọn": nếu thẻ biến mất giữa chừng (xoá ở
  // tab khác), dialog đóng hẳn thay vì chuyển sang chế độ thêm mới hoặc bật lại cho
  // thẻ khác được chọn sau đó.
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const editCard = formMode?.kind === 'edit'
    ? cards.find((c) => c.id === formMode.cardId) ?? null
    : null
  const formOpen = formMode?.kind === 'create' || editCard !== null
  const deleteTarget = cards.find((c) => c.id === deleteTargetId) ?? null

  const openCreate = () => setFormMode({ kind: 'create' })

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Thẻ tín dụng</h1>
        </div>
        <div className="flex items-center gap-2">
          {card && (
            <>
              <Button
                variant="outline" size="sm" aria-label="Sửa thẻ đang chọn"
                onClick={() => setFormMode({ kind: 'edit', cardId: card.id })}
              >
                <Pencil className="h-4 w-4" /> Sửa
              </Button>
              <Button
                variant="outline" size="sm" aria-label="Xoá thẻ đang chọn"
                onClick={() => setDeleteTargetId(card.id)}
              >
                <Trash2 className="h-4 w-4" /> Xoá
              </Button>
            </>
          )}
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm thẻ
          </Button>
        </div>
      </div>

      {isError && !cardsData ? (
        // Lỗi tải KHÔNG được hiện như "chưa có thẻ": user sẽ bị mời thêm lại thẻ đã có.
        <div role="alert" className="rounded-lg border border-destructive/40 p-10 text-center">
          <p className="font-medium">Không tải được danh sách thẻ</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Kiểm tra kết nối rồi thử lại. Thẻ của bạn không bị mất.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>Thử lại</Button>
        </div>
      ) : !isLoading && cards.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Chưa có thẻ tín dụng nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thêm thẻ để giao dịch từ tin nhắn ngân hàng tự động gắn vào đúng thẻ.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm thẻ đầu tiên
          </Button>
        </div>
      ) : (
        <>
          {/* Card switcher — sets cardId in Zustand filter store.
              Combobox có tìm kiếm thay cho Tabs: 41 thẻ vượt xa ngưỡng ~15 mục
              mà tabs còn dùng được, và TabsList khoá chiều cao khiến layout vỡ. */}
          <CreditCardSelector />

          {/* Billing cycle info — shows current cycle dates and urgency badge */}
          {card && <BillingCycleInfoCard card={card} />}

          {/* Filter bar — search, date range, transaction type */}
          <FilterBar />

          {/* Credit card transaction list — reads cardId + filters from Zustand */}
          <CreditCardTransactionList />
        </>
      )}

      <CardFormDialog
        open={formOpen} card={editCard}
        onOpenChange={(open) => { if (!open) setFormMode(null) }}
      />
      <DeleteCardDialog
        open={deleteTarget !== null} card={deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }}
      />
    </div>
  )
}
