import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useFilterStore } from '@/stores/filterStore'
import { useDebounced } from '@/hooks/useDebounced'

export function SearchInput() {
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery)
  const [local, setLocal] = useState('')
  const debounced = useDebounced(local, 350)

  useEffect(() => {
    setSearchQuery(debounced)
  }, [debounced, setSearchQuery])

  return (
    <div className="relative flex-1 min-w-[160px]">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="Tìm theo tên hoặc mô tả..."
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="pl-8 pr-8 min-h-[44px]"
      />
      {local && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => {
            setLocal('')
            setSearchQuery('')
          }}
          aria-label="Xóa tìm kiếm"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
