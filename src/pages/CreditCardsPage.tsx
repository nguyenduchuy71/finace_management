import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCardSelector } from '@/features/creditCards/CreditCardSelector'
import { CreditCardTransactionList } from '@/features/creditCards/CreditCardTransactionList'
import { BillingCycleInfoCard } from '@/features/creditCards/BillingCycleInfoCard'
import { CardFormDialog } from '@/features/creditCards/CardFormDialog'
import { DeleteCardDialog } from '@/features/creditCards/DeleteCardDialog'
import { FilterBar } from '@/components/filters/FilterBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MultiCardPicker } from '@/features/creditCards/MultiCardPicker'
import { MultiCardTransactionList } from '@/features/creditCards/MultiCardTransactionList'
import { Button } from '@/components/ui/button'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useFilterStore } from '@/stores/filterStore'
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/empty-state/EmptyState'

/** Form đang thêm thẻ mới, hoặc sửa một thẻ (theo id); null = đóng. */
type FormMode = { kind: 'create' } | { kind: 'edit'; cardId: string } | null
/** "Từng thẻ" (mặc định) hoặc "Nhiều thẻ" — nằm trên URL (?view=all) để tải lại không nhảy mục. */
type View = 'card' | 'all'

export function CreditCardsPage() {
  const { data: cardsData, isLoading, isError, refetch } = useCreditCards()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'all' ? 'all' : 'card'
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
      <PageHeader
        icon={CreditCard}
        title="Thẻ tín dụng"
        actions={
          <>
            {view === 'card' && card && (
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
          </>
        }
      />

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
        <EmptyState
          bordered icon={CreditCard}
          title="Chưa có thẻ tín dụng nào"
          description="Thêm thẻ để giao dịch từ tin nhắn ngân hàng tự động gắn vào đúng thẻ."
          action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Thêm thẻ đầu tiên</Button>}
        />
      ) : (
        <Tabs value={view} onValueChange={(v) => setParams(v === 'card' ? {} : { view: v }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="card" className="min-h-[44px]">Từng thẻ</TabsTrigger>
            <TabsTrigger value="all" className="min-h-[44px]">Nhiều thẻ</TabsTrigger>
          </TabsList>

          <TabsContent value="card" className="mt-4 space-y-4">
            {/* Combobox có tìm kiếm thay cho Tabs: 41 thẻ vượt xa ngưỡng ~15 mục mà tabs còn dùng được. */}
            <CreditCardSelector />
            {card && <BillingCycleInfoCard card={card} />}
            <FilterBar />
            <CreditCardTransactionList />
          </TabsContent>

          {/* Radix gỡ nội dung mục ẩn: hai danh sách không cùng truy vấn một lúc */}
          <TabsContent value="all" className="mt-4 space-y-4">
            <MultiCardPicker />
            <FilterBar showExport={false} />
            <MultiCardTransactionList />
          </TabsContent>
        </Tabs>
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
