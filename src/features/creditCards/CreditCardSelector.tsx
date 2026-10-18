import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/stores/filterStore'
import { useCreditCards } from '@/hooks/useCreditCards'
import { BankLogo } from './BankLogo'
import { CARD_TYPE_LABEL } from './bank-branding'
import { cn } from '@/lib/utils'
import type { CreditCard } from '@/types/creditCard'

/** Bỏ dấu tiếng Việt để gõ "the tin dung" vẫn tìm ra "Thẻ tín dụng". */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

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
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [rawActiveIndex, setActiveIndex] = useState(0)

  const cards: CreditCard[] = useMemo(() => data?.data ?? [], [data])

  // Chọn sẵn thẻ đầu tiên khi tải xong — không có thẻ nào được chọn thì
  // danh sách giao dịch bên dưới sẽ trống mà không rõ lý do. Cũng áp dụng khi cardId
  // trỏ vào thẻ đã biến mất (xoá ở tab/thiết bị khác, hoặc vừa xoá thẻ đang chọn):
  // nếu không, selector hiện "Chọn thẻ…" và nút Sửa/Xoá biến mất mà không tự hồi phục.
  useEffect(() => {
    if (cards.length > 0 && !cards.some((c) => c.id === cardId)) setCardId(cards[0].id)
  }, [cards, cardId, setCardId])

  const selected = cards.find((c) => c.id === cardId) ?? null

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return cards
    return cards.filter((c) =>
      normalize(c.cardName).includes(q) ||
      normalize(c.bankName).includes(q) ||
      c.cardNumber.includes(q)
    )
  }, [cards, query])

  // Kẹp con trỏ vào trong mảng thay vì reset bằng useEffect: sau khi lọc,
  // activeIndex cũ có thể vượt quá độ dài danh sách mới. Tính lúc render tránh
  // được một vòng render thừa (và cảnh báo cascading render của eslint).
  const activeIndex = Math.min(rawActiveIndex, Math.max(filtered.length - 1, 0))

  // Giữ mục đang chọn luôn nằm trong tầm nhìn khi di chuyển bằng bàn phím
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function choose(id: string) {
    setCardId(id)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const card = filtered[activeIndex]
      if (card) choose(card.id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(filtered.length - 1)
    }
  }

  if (isLoading) return <Skeleton className="h-14 w-full max-w-md rounded-lg" />
  if (cards.length === 0) return null

  const listboxId = 'credit-card-listbox'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          // Reset ngay trong handler (sự kiện người dùng), không dùng useEffect
          // -> tránh cascading render.
          if (next) {
            setQuery('')
            setActiveIndex(0)
          }
        }}
      >
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

        <PopoverContent
          className="w-[min(24rem,calc(100vw-2rem))] p-0"
          align="start"
          onOpenAutoFocus={(e) => {
            // Chặn Radix focus vào phần tử đầu tiên, tự focus ô tìm kiếm để
            // người dùng gõ được ngay khi mở.
            e.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Tìm theo tên thẻ, ngân hàng hoặc 4 số cuối…"
              aria-label="Tìm thẻ"
              aria-controls={listboxId}
              aria-activedescendant={
                filtered[activeIndex] ? `card-opt-${filtered[activeIndex].id}` : undefined
              }
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Danh sách thẻ tín dụng"
            className="max-h-72 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Không tìm thấy thẻ nào.
              </p>
            ) : (
              filtered.map((card, i) => {
                const isSelected = card.id === cardId
                return (
                  <div
                    key={card.id}
                    id={`card-opt-${card.id}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(card.id)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm',
                      i === activeIndex && 'bg-accent',
                      isSelected && 'font-medium'
                    )}
                  >
                    <BankLogo bankName={card.bankName} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{card.cardName}</span>
                      <span className="text-xs text-muted-foreground">
                        {card.bankName}
                        {CARD_TYPE_LABEL[card.cardType] ? ` · ${CARD_TYPE_LABEL[card.cardType]}` : ''}
                        {' · ···· '}{card.cardNumber.slice(-4)}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </div>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      <span className="text-sm text-muted-foreground">
        {cards.length} thẻ
      </span>
    </div>
  )
}
