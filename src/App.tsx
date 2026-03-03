import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'

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

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <h1 className="p-4 text-2xl font-bold">FinanceManager</h1>
          {/* Routes added in Phase 2 */}
        </div>
      </BrowserRouter>
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
