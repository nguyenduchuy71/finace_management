import { useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFilterStore } from '@/stores/filterStore'
import { useAccounts } from '@/hooks/useAccounts'
import { Skeleton } from '@/components/ui/skeleton'
import type { BankAccount } from '@/types/account'

interface AccountTabsProps {
  onAccountChange?: (accountId: string) => void
}

export function AccountTabs({ onAccountChange }: AccountTabsProps) {
  const accountId = useFilterStore((s) => s.accountId)
  const setAccountId = useFilterStore((s) => s.setAccountId)
  const { data, isLoading } = useAccounts()

  const accounts: BankAccount[] = data?.data ?? []

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

  return (
    <Tabs value={accountId ?? accounts[0].id} onValueChange={handleChange}>
      <TabsList className="h-auto flex-wrap">
        {accounts.map((account) => (
          <TabsTrigger
            key={account.id}
            value={account.id}
            className="min-h-[44px] text-sm"
          >
            <span className="font-medium">{account.bankName}</span>
            <span className="ml-1.5 text-xs opacity-70">{account.accountNumber.slice(-4)}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
