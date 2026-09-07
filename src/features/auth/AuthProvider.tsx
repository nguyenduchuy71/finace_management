import { createContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  session: Session | null
  loading: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue>({ session: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // `loading` bắt buộc: thiếu nó thì mỗi lần reload sẽ nháy sang /login
  // trong lúc getSession() còn đang chạy, dù user đã đăng nhập.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Chặn setState sau khi unmount (StrictMode mount/unmount 2 lần ở dev).
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session)
      })
      .catch((err) => {
        // getSession() có gọi mạng (refresh token) nên CÓ THỂ reject.
        // Không bắt lỗi ở đây thì loading kẹt true vĩnh viễn -> user đứng
        // ở màn "Đang tải…" không thoát được. Coi như chưa đăng nhập.
        console.error('[auth] không lấy được session:', err)
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Không memo thì mỗi render tạo object mới -> mọi consumer re-render theo.
  const value = useMemo(() => ({ session, loading }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
