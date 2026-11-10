import { useEffect, useMemo, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFilterStore } from '@/stores/filterStore'
import { useAccounts } from '@/hooks/useAccounts'
import { Skeleton } from '@/components/ui/skeleton'
import type { BankAccount } from '@/types/account'

interface AccountTabsProps {
  onAccountChange?: (accountId: string) => void
  /** Nút cạnh hàng tab (menu ⋯ của TK đang chọn). */
  actions?: ReactNode
  /** Nội dung của TK đang chọn — nằm trong tab panel để `aria-controls` của tab trỏ tới phần tử có thật
   *  (trước đây Tabs không có panel: axe báo aria-valid-attr-value mức critical). */
  children?: ReactNode
}

export function AccountTabs({ onAccountChange, actions, children }: AccountTabsProps) {
  const accountId = useFilterStore((s) => s.accountId)
  const setAccountId = useFilterStore((s) => s.setAccountId)
  const { data, isLoading } = useAccounts()

  const accounts: BankAccount[] = useMemo(() => data?.data ?? [], [data])

  // Initialize to first account when accounts load and no account is selected
  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      const firstId = accounts[0].id
      setAccountId(firstId)
      onAccountChange?.(firstId)
    }
  }, [accounts, accountId, setAccountId, onAccountChange])

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    )
  }

  if (accounts.length === 0) return null

  function handleChange(value: string) {
    setAccountId(value)
    onAccountChange?.(value)
  }

  const activeId = accountId ?? accounts[0].id
  return (
    <Tabs value={activeId} onValueChange={handleChange} className="gap-4">
      <div className="flex items-start gap-2">
        {/* h-auto PHẢI đi kèm flex-wrap: TabsList mặc định khoá `h-9`, nên khi
            các trigger wrap xuống hàng 2 thì container vẫn cao 36px và nội dung
            bên dưới bị đè lên. `[&>*]:flex-none` chặn trigger co giãn theo
            flex-1 mặc định — nếu không, mỗi hàng wrap sẽ có bề rộng lệch nhau. */}
        <TabsList className="h-auto min-w-0 flex-1 flex-wrap justify-start [&>*]:h-auto [&>*]:flex-none sm:flex-none">
          {accounts.map((account) => (
            <TabsTrigger
              key={account.id}
              value={account.id}
              className="min-h-[44px] text-sm"
            >
              <span className="font-medium">{account.bankName}</span>
              {/* Không dùng opacity: 70% màu primary trên nền chỉ đạt 3:1 (axe color-contrast) */}
              <span className="ml-1.5 text-xs font-normal">{account.accountNumber.slice(-4)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {actions}
      </div>
      <TabsContent value={activeId} className="space-y-4">{children}</TabsContent>
    </Tabs>
  )
}
