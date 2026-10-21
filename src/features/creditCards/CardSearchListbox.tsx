import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CreditCard } from '@/types/creditCard'
import { BankLogo } from './BankLogo'
import { CARD_TYPE_LABEL } from './bank-branding'

/** Bỏ dấu tiếng Việt để gõ "the tin dung" vẫn tìm ra "Thẻ tín dụng". */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface CardSearchListboxProps {
  id: string
  cards: CreditCard[]
  selectedIds: ReadonlySet<string>
  onPick: (cardId: string) => void
  /** Chọn nhiều: listbox `aria-multiselectable`, Enter/Space bật-tắt mục đang trỏ. */
  multiple?: boolean
}

/**
 * Ô tìm kiếm + listbox thẻ dùng chung cho chọn 1 thẻ (CreditCardSelector) và nhiều thẻ (MultiCardPicker).
 * Đặt trong PopoverContent: Radix gỡ nội dung khi đóng nên ô tìm kiếm và con trỏ tự reset mỗi lần mở.
 */
export function CardSearchListbox({ id, cards, selectedIds, onPick, multiple = false }: CardSearchListboxProps) {
  const [query, setQuery] = useState('')
  const [rawActiveIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

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

  // Giữ mục đang trỏ luôn nằm trong tầm nhìn khi di chuyển bằng bàn phím
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || (multiple && e.key === ' ' && query === '')) {
      e.preventDefault()
      const card = filtered[activeIndex]
      if (card) onPick(card.id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(filtered.length - 1)
    }
  }

  return (
    <>
      <div className="flex items-center border-b px-3">
        <Search className="h-4 w-4 shrink-0 opacity-50" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tìm theo tên thẻ, ngân hàng hoặc 4 số cuối…"
          aria-label="Tìm thẻ"
          aria-controls={id}
          aria-activedescendant={filtered[activeIndex] ? `${id}-${filtered[activeIndex].id}` : undefined}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>

      <div
        ref={listRef}
        id={id}
        role="listbox"
        aria-label="Danh sách thẻ tín dụng"
        aria-multiselectable={multiple || undefined}
        className="max-h-72 overflow-y-auto p-1"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Không tìm thấy thẻ nào.</p>
        ) : (
          filtered.map((card, i) => {
            const isSelected = selectedIds.has(card.id)
            return (
              <div
                key={card.id}
                id={`${id}-${card.id}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onClick={() => onPick(card.id)}
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
    </>
  )
}
