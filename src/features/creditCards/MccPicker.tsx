import { useId, useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useListboxKeyboard } from '@/hooks/useListboxKeyboard'
import { cn } from '@/lib/utils'
import { MCC_OPTIONS, formatMcc, getMccLabel } from '@/utils/mcc'
import { getMccGroup, searchMcc } from '@/utils/mcc-search'

interface MccPickerProps {
  /** Mã đang chọn; '' = chưa chọn (hiện `noneLabel`). */
  value: string
  /** '' = bỏ chọn. */
  onChange: (code: string) => void
  /** Nhãn của lựa chọn "không có mã": "Chưa phân loại MCC" / rule mặc định. */
  noneLabel: string
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-busy'?: boolean
  /** Mã không được chọn (vd đã có rule); '' = khoá lựa chọn "không có mã". */
  disabledCodes?: ReadonlySet<string>
  className?: string
}

interface Item { code: string; primary: string; secondary?: string }

const TOTAL = MCC_OPTIONS.length

/**
 * Chọn MCC trong ~1000 mã: nút mở popover có ô tìm (theo mã, tên nhóm, từ khoá merchant). Thay cho
 * <select>: một <select> nghìn option lặp ở mỗi dòng giao dịch vừa nặng DOM vừa không tìm được.
 * Popover chỉ dựng khi mở và tối đa 50 kết quả. Mã 4 chữ số ngoài danh sách vẫn chọn được (DB chỉ
 * kiểm 4 chữ số; ngân hàng có thể dùng mã mới hơn bộ dữ liệu).
 */
export function MccPicker({
  value, onChange, noneLabel, id, disabledCodes, className, ...aria
}: MccPickerProps) {
  const [open, setOpen] = useState(false)
  const listboxId = useId()

  function pick(code: string) {
    if (disabledCodes?.has(code)) return
    onChange(code)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          // Nút mở một popover; combobox thật là ô tìm bên trong (nơi giữ focus và điều khiển listbox).
          aria-haspopup="dialog"
          aria-expanded={open}
          {...aria}
          className={cn('h-8 justify-between gap-2 px-2.5 text-xs font-normal aria-busy:opacity-60', className)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? formatMcc(value) : noneLabel}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
        <MccSearchListbox
          id={listboxId} value={value} noneLabel={noneLabel} disabledCodes={disabledCodes} onPick={pick}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Nội dung popover — Radix gỡ khi đóng nên ô tìm và con trỏ tự reset mỗi lần mở. */
function MccSearchListbox({ id, value, noneLabel, disabledCodes, onPick }: {
  id: string
  value: string
  noneLabel: string
  disabledCodes?: ReadonlySet<string>
  onPick: (code: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim()

  const items = useMemo<Item[]>(() => {
    const found: Item[] = searchMcc(q).map((o) => ({
      code: o.code, primary: formatMcc(o.code), secondary: getMccGroup(o.code),
    }))
    if (/^\d{4}$/.test(q) && getMccLabel(q) === undefined) {
      found.unshift({ code: q, primary: `Dùng mã ${q}`, secondary: 'Ngoài danh sách' })
    }
    return q ? found : [{ code: '', primary: noneLabel }, ...found]
  }, [q, noneLabel])

  const { activeIndex, setActiveIndex, listRef, onKeyDown } = useListboxKeyboard(
    items.length, (i) => onPick(items[i].code),
  )

  return (
    <>
      <div className="flex items-center border-b px-3">
        <Search className="h-4 w-4 shrink-0 opacity-50" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Tìm theo mã, nhóm hoặc tên cửa hàng…"
          role="combobox"
          aria-expanded
          aria-autocomplete="list"
          aria-label="Tìm MCC"
          aria-controls={id}
          aria-activedescendant={items[activeIndex] ? `${id}-${activeIndex}` : undefined}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      {!q && (
        <p className="px-3 pt-2 text-xs text-muted-foreground">
          Nhóm hay gặp — gõ để tìm trong {TOTAL} mã.
        </p>
      )}
      <div ref={listRef} id={id} role="listbox" aria-label="Danh sách MCC" className="max-h-72 overflow-y-auto p-1">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Không tìm thấy mã nào.</p>
        ) : (
          items.map((item, i) => {
            const isSelected = item.code === value
            const isDisabled = disabledCodes?.has(item.code) ?? false
            return (
              <div
                key={item.code || 'none'}
                id={`${id}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled || undefined}
                onClick={() => onPick(item.code)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  i === activeIndex && 'bg-accent',
                  isSelected && 'font-medium',
                  isDisabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{item.primary}</span>
                  {item.secondary && <span className="text-xs text-muted-foreground">{item.secondary}</span>}
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
