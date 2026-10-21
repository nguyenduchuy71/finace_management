import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/stores/filterStore'
import { useCreditCards } from '@/hooks/useCreditCards'
import type { CreditCard } from '@/types/creditCard'
import { BankLogo } from './BankLogo'
import { CardSearchListbox } from './CardSearchListbox'

const LISTBOX_ID = 'multi-card-listbox'

/**
 * Chọn tập thẻ cho mục "Nhiều thẻ". Không chọn thẻ nào = "Tất cả thẻ" (chip đầu, bấm để bỏ hết lựa chọn).
 * Popover giữ mở khi bật/tắt để chọn liền nhiều thẻ.
 */
export function MultiCardPicker() {
  const cardIds = useFilterStore((s) => s.cardIds)
  const setCardIds = useFilterStore((s) => s.setCardIds)
  const { data, isLoading } = useCreditCards()
  const cards: CreditCard[] = useMemo(() => data?.data ?? [], [data])
  const [open, setOpen] = useState(false)

  // Thẻ đã xoá (tab khác / vừa xoá) phải rời khỏi lựa chọn: nếu không, truy vấn `.in` vẫn gửi id
  // cũ và chip của nó không có gì để hiện. Chỉ sửa khi danh sách thẻ đã tải xong.
  useEffect(() => {
    if (!data) return
    const kept = cardIds.filter((id) => cards.some((c) => c.id === id))
    if (kept.length !== cardIds.length) setCardIds(kept)
  }, [data, cards, cardIds, setCardIds])

  const selectedIds = useMemo(() => new Set(cardIds), [cardIds])
  const selected = cards.filter((c) => selectedIds.has(c.id))

  function toggle(id: string) {
    setCardIds(selectedIds.has(id) ? cardIds.filter((x) => x !== id) : [...cardIds, id])
  }

  if (isLoading) return <Skeleton className="h-11 w-full max-w-md rounded-lg" />

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Thẻ đang xem">
      <button
        type="button"
        onClick={() => setCardIds([])}
        aria-pressed={cardIds.length === 0}
        className={cn(
          'touch-target rounded-full border px-4 text-sm font-medium transition-colors duration-200',
          cardIds.length === 0 ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
        )}
      >
        Tất cả thẻ ({cards.length})
      </button>

      {selected.map((card) => (
        <span key={card.id} className="flex min-h-11 items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-1 text-sm">
          <BankLogo bankName={card.bankName} className="h-7 w-7 rounded-full" />
          <span className="max-w-40 truncate">{card.cardName}</span>
          <span className="money text-xs text-muted-foreground">{card.cardNumber.slice(-4)}</span>
          <button
            type="button"
            onClick={() => toggle(card.id)}
            aria-label={`Bỏ ${card.cardName} khỏi danh sách xem`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? LISTBOX_ID : undefined}
            aria-label="Chọn thẻ để xem"
            className="touch-target rounded-full"
          >
            <Plus className="h-4 w-4" /> Chọn thẻ
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
          <CardSearchListbox id={LISTBOX_ID} cards={cards} selectedIds={selectedIds} onPick={toggle} multiple />
        </PopoverContent>
      </Popover>
    </div>
  )
}
