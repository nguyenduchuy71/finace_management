import { useContext } from 'react'
import { AuthContext } from '@/features/auth/AuthProvider'

export function useAuth() {
  return useContext(AuthContext)
}
