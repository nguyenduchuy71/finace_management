import { createContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/query-client'
import { useChatStore } from '@/stores/chatStore'

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
  // User của phiên đã có dữ liệu trong cache. Đổi user hoặc mất phiên (hết hạn, đăng xuất ở tab
  // khác — không đi qua nút đăng xuất của AppHeader) -> xoá cache, kể cả dữ liệu trang quản trị,
  // và lịch sử chat + API key Claude trong localStorage (không gắn với user, máy dùng chung sẽ lộ).
  const cachedUserId = useRef<string | null | undefined>(undefined)

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
      if (!active) return
      const nextUserId = next?.user.id ?? null
      if (cachedUserId.current !== undefined && cachedUserId.current !== nextUserId) {
        queryClient.clear()
        useChatStore.getState().resetForSignOut()
      }
      cachedUserId.current = nextUserId
      setSession(next)
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
