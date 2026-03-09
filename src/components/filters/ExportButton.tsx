import { useState } from 'react'
import { Download } from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useFilterStore, useFilterParams } from '@/stores/filterStore'
import { useCategoryOverrideStore } from '@/stores/categoryOverrideStore'
import { useAccounts } from '@/hooks/useAccounts'
import { useCreditCards } from '@/hooks/useCreditCards'
import { exportTransactions } from '@/services/exports'
import { formatTransactionForCSV, downloadCSV } from '@/utils/csv'

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false)

  const accountId = useFilterStore((s) => s.accountId)
  const cardId = useFilterStore((s) => s.cardId)
  const filters = useFilterParams()

  const { data: accountsData } = useAccounts()
  const { data: cardsData } = useCreditCards()

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const accountOrCardId = accountId ?? cardId
      const exportFilters = cardId && !accountId
        ? { ...filters, cardId }
        : filters

      const response = await exportTransactions(accountOrCardId, exportFilters)

      // Find account or card for the "Tai khoan" column
      const account = accountsData?.data.find((a) => a.id === accountId) ?? undefined
      const card = cardsData?.data.find((c) => c.id === cardId) ?? undefined
      const accountOrCard = account ?? card

      // Get category overrides
      const categoryOverrides = useCategoryOverrideStore.getState().overrides

      // Transform transactions to CSV rows
      const csvRows = response.data.map((tx) =>
        formatTransactionForCSV(tx, accountOrCard, categoryOverrides)
      )

      // Generate CSV string
      const csvString = Papa.unparse(csvRows, {
        header: true,
        delimiter: ',',
        newline: '\r\n',
      })

      // Generate filename with today's date
      const today = new Date().toISOString().split('T')[0]
      const filename = `transactions-${today}.csv`

      downloadCSV(csvString, filename)
      toast.success('Đã tải xuống CSV')
    } catch {
      toast.error('Tải xuống thất bại')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="touch-target text-muted-foreground hover:text-foreground transition-colors duration-200"
    >
      <Download className="h-4 w-4 mr-1.5 opacity-60" />
      {isExporting ? 'Đang tải...' : 'Xuất CSV'}
    </Button>
  )
}
