import axios from 'axios'
import type { ApiError } from '@/types/api'

export const apiClient = axios.create({
  baseURL: '/api',        // MSW intercepts all /api/* paths
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: placeholder for real auth token injection (Phase 5+)
apiClient.interceptors.request.use((config) => {
  return config
})

// Response interceptor: normalize all errors to the locked ApiError shape
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as {
      response?: { status?: number; data?: { message?: string; details?: unknown } }
      message?: string
    }
    const apiError: ApiError = {
      code: axiosError.response?.status?.toString() ?? 'NETWORK_ERROR',
      message: axiosError.response?.data?.message ?? axiosError.message ?? 'Unknown error',
      details: axiosError.response?.data?.details,
    }
    return Promise.reject(apiError)
  }
)
