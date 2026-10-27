import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LandingHeader } from './LandingHeader'
import { LandingHero } from './LandingHero'
import { LandingFeatures } from './LandingFeatures'
import { LandingHowItWorks } from './LandingHowItWorks'
import { LandingCta, LandingSecurity } from './LandingSecurity'

/** Trang chủ công khai. Đã đăng nhập thì vào thẳng app như route `/` trước đây. */
export function LandingPage() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/accounts" replace />

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingSecurity />
        <LandingCta />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} FinanceManager</p>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-foreground">Đăng nhập</Link>
            <Link to="/signup" className="hover:text-foreground">Đăng ký</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
