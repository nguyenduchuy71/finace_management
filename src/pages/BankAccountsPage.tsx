import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RecordedTransactionsView } from '@/features/accounts/RecordedTransactionsView'
import { UnparsedInbox } from '@/features/unparsed/UnparsedInbox'
import { UnparsedCountBadge } from '@/features/unparsed/UnparsedCountBadge'
import { Building2 } from 'lucide-react'

type View = 'inbox' | 'recorded'

/**
 * "Giao dịch ngân hàng": mặc định mở hộp tin chưa phân loại (việc cần làm), mục thứ hai
 * là giao dịch đã ghi theo tài khoản. Mục đang mở nằm trên URL (?view=) để tải lại /
 * chia sẻ link không nhảy về mục khác.
 */
export function BankAccountsPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'recorded' ? 'recorded' : 'inbox'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Giao dịch ngân hàng</h1>
      </div>

      <Tabs value={view} onValueChange={(v) => setParams(v === 'inbox' ? {} : { view: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="inbox" className="min-h-[44px]">
            Chưa phân loại <UnparsedCountBadge className="ml-1.5" />
          </TabsTrigger>
          <TabsTrigger value="recorded" className="min-h-[44px]">Đã ghi nhận</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-4"><UnparsedInbox /></TabsContent>
        <TabsContent value="recorded" className="mt-4"><RecordedTransactionsView /></TabsContent>
      </Tabs>
    </div>
  )
}
