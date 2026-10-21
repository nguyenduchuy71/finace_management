import { useEffect, useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/stores/filterStore'
import { useCreditCards } from '@/hooks/useCreditCards'
import { BankLogo } from './BankLogo'
import { CardSearchListbox } from './CardSearchListbox'
import type { CreditCard } from '@/types/creditCard'

/**
 * Chọn 1 thẻ trong ~41 thẻ.
 *
 * Trước đây dùng Tabs và layout VỠ: TabsList của shadcn khoá chiều cao `h-9`,
 * nên 41 trigger wrap thành 8 hàng nhưng container vẫn cao 36px -> mọi thứ bên
 * dưới (chu kỳ sao kê, thanh lọc) bị đè lên nhau.
 *
 * Tabs cũng sai về mặt UX ở quy mô này: Nielsen Norman Group khuyến nghị
 * dropdown tối đa ~15 mục, 41 là gấp 2,7 lần. Combobox có ô tìm kiếm thu 41 mục
 * xuống còn vài mục chỉ với 1-2 phím gõ.
 */
export function CreditCardSelector() {
  const cardId = useFilterStore((s) => s.cardId)
  const setCardId = useFilterStore((s) => s.setCardId)
  const { data, isLoading } = useCreditCards()

  const [open, setOpen] = useState(false)

  const cards: CreditCard[] = useMemo(() => data?.data ?? [], [data])

  // Chọn sẵn thẻ đầu tiên khi tải xong — không có thẻ nào được chọn thì
  // danh sách giao dịch bên dưới sẽ trống mà không rõ lý do. Cũng áp dụng khi cardId
  // trỏ vào thẻ đã biến mất (xoá ở tab/thiết bị khác, hoặc vừa xoá thẻ đang chọn):
  // nếu không, selector hiện "Chọn thẻ…" và nút Sửa/Xoá biến mất mà không tự hồi phục.
  useEffect(() => {
    if (cards.length > 0 && !cards.some((c) => c.id === cardId)) setCardId(cards[0].id)
  }, [cards, cardId, setCardId])

  const selected = cards.find((c) => c.id === cardId) ?? null
  const selectedIds = useMemo(() => new Set(cardId ? [cardId] : []), [cardId])

  function choose(id: string) {
    setCardId(id)
    setOpen(false)
  }

  if (isLoading) return <Skeleton className="h-14 w-full max-w-md rounded-lg" />
  if (cards.length === 0) return null

  const listboxId = 'credit-card-listbox'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-label="Chọn thẻ tín dụng"
            className="h-auto w-full justify-between gap-3 px-3 py-2 sm:w-96"
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-3">
                <BankLogo bankName={selected.bankName} size="md" />
                <span className="flex min-w-0 flex-col items-start">
                  <span className="truncate text-sm font-medium">{selected.cardName}</span>
                  <span className="text-xs text-muted-foreground">
                    {selected.bankName} ·  ···· {selected.cardNumber.slice(-4)}
                  </span>
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Chọn thẻ…</span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
          <CardSearchListbox
            id={listboxId}
            cards={cards}
            selectedIds={selectedIds}
            onPick={choose}
          />
        </PopoverContent>
      </Popover>

      <span className="text-sm text-muted-foreground">
        {cards.length} thẻ
      </span>
    </div>
  )
}
