import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createApiKey, listApiKeys, revokeApiKey } from '@/services/api-keys'
import { QK } from './query-keys'

const API_KEYS_KEY = QK.apiKeys

export function useApiKeys() {
  return useQuery({ queryKey: API_KEYS_KEY, queryFn: listApiKeys })
}

/** Trả key đầy đủ qua `mutateAsync` để dialog hiện đúng một lần; không toast key. */
export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createApiKey(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: API_KEYS_KEY }),
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: API_KEYS_KEY })
      toast.success('Đã thu hồi key')
    },
  })
}
