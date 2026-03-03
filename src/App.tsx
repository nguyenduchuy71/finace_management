import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { useTransactions } from '@/hooks/useTransactions'
import { formatVND } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dates'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 min — finance data is not real-time
      gcTime: 1000 * 60 * 10,        // 10 min cache retention
      retry: 2,                       // 2 retries before showing error state (locked decision)
      refetchOnWindowFocus: false,    // Personal dashboard, not live feed
    },
  },
})

// Proof-of-concept component — replaced by real components in Phase 2
function TransactionList() {
  const { data, isLoading, isError, error } = useTransactions()

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Đang tải giao dịch...</div>
  }

  if (isError) {
    return (
      <div className="p-4 text-destructive">
        Lỗi tải dữ liệu: {(error as { message: string })?.message ?? 'Unknown error'}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-lg font-semibold">Giao dịch gần đây</h2>
      {data?.data.slice(0, 5).map((tx) => (
        <div key={tx.id} className="flex justify-between items-center border rounded p-3">
          <div>
            <p className="font-medium">{tx.merchantName ?? tx.description}</p>
            <p className="text-sm text-muted-foreground">{formatDisplayDate(tx.transactionDate)}</p>
          </div>
          <span className={tx.type === 'income' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
            {tx.type === 'income' ? '+' : ''}{formatVND(Math.abs(tx.amount))}
          </span>
        </div>
      ))}
      {data?.data.length === 0 && (
        <p className="text-muted-foreground">Không có giao dịch nào.</p>
      )}
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background max-w-2xl mx-auto">
          <header className="p-4 border-b">
            <h1 className="text-2xl font-bold">FinanceManager</h1>
          </header>
          <TransactionList />
        </div>
      </BrowserRouter>
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
