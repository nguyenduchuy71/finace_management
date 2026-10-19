import { QueryClient } from '@tanstack/react-query'

/** Dùng chung toàn app; AppHeader gọi `.clear()` khi đăng xuất để không rò cache sang người dùng sau. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 min — finance data is not real-time
      gcTime: 1000 * 60 * 10,         // 10 min cache retention
      retry: 2,                        // 2 retries before showing error state (locked decision)
      refetchOnWindowFocus: false,     // Personal dashboard, not live feed
    },
  },
})
