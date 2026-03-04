import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui/skeleton'

// Route-based lazy loading — page chunks load only when the route is navigated to.
// AppShell stays static so layout renders immediately without a flash.
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => m.DashboardPage ? Promise.resolve({ default: m.DashboardPage }) : Promise.reject(new Error('DashboardPage not found'))))
const BankAccountsPage = lazy(() => import('@/pages/BankAccountsPage').then((m) => m.BankAccountsPage ? Promise.resolve({ default: m.BankAccountsPage }) : Promise.reject(new Error('BankAccountsPage not found'))))
const CreditCardsPage = lazy(() => import('@/pages/CreditCardsPage').then((m) => m.CreditCardsPage ? Promise.resolve({ default: m.CreditCardsPage }) : Promise.reject(new Error('CreditCardsPage not found'))))

function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 min — finance data is not real-time
      gcTime: 1000 * 60 * 10,         // 10 min cache retention
      retry: 2,                        // 2 retries before showing error state (locked decision)
      refetchOnWindowFocus: false,     // Personal dashboard, not live feed
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/accounts" replace />} />
            <Suspense fallback={<PageSkeleton />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/accounts" element={<BankAccountsPage />} />
              <Route path="/credit-cards" element={<CreditCardsPage />} />
            </Suspense>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}
