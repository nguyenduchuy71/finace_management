import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { BankAccountsPage } from '@/pages/BankAccountsPage'
import { CreditCardsPage } from '@/pages/CreditCardsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PaymentReturnPage } from '@/pages/PaymentReturnPage'

// Chunk riêng: trang pháp lý (công khai, nội dung tĩnh) và admin chỉ tải khi vào.
const PrivacyPage = lazy(() => import('@/features/legal/PrivacyPage'))
const TermsPage = lazy(() => import('@/features/legal/TermsPage'))
const AdminPage = lazy(() => import('@/pages/AdminPage'))

const LegalFallback = () => <p className="p-6 text-sm text-muted-foreground">Đang tải…</p>

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route index element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/privacy" element={<Suspense fallback={<LegalFallback />}><PrivacyPage /></Suspense>} />
            <Route path="/terms" element={<Suspense fallback={<LegalFallback />}><TermsPage /></Suspense>} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/accounts" element={<BankAccountsPage />} />
                <Route path="/credit-cards" element={<CreditCardsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/payment/return" element={<PaymentReturnPage />} />
                <Route
                  path="/admin"
                  element={<Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}><AdminPage /></Suspense>}
                />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  )
}
