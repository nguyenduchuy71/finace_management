import { useState } from 'react'
import { KeyRound, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useApiKeys, useRevokeApiKey } from '@/hooks/useApiKeys'
import { formatDisplayDateTime } from '@/utils/dates'
import { MAX_ACTIVE_API_KEYS, type ApiKey } from '@/types/api-key'
import type { ApiError } from '@/types/api'
import { toast } from 'sonner'
import { CreateApiKeyDialog } from './CreateApiKeyDialog'

function ApiKeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (k: ApiKey) => void }) {
  const revoked = apiKey.revokedAt !== null
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">{apiKey.name}</span>
          {revoked && <Badge variant="secondary">Đã thu hồi</Badge>}
        </div>
        <p className="font-mono text-xs text-muted-foreground">{apiKey.prefix}…{apiKey.last4}</p>
        <p className="text-xs text-muted-foreground">
          Tạo {formatDisplayDateTime(apiKey.createdAt)} ·{' '}
          {apiKey.lastUsedAt ? `Dùng lần cuối ${formatDisplayDateTime(apiKey.lastUsedAt)}` : 'Chưa dùng'}
        </p>
      </div>
      {!revoked && (
        <Button type="button" variant="outline" size="sm" onClick={() => onRevoke(apiKey)}>Thu hồi</Button>
      )}
    </li>
  )
}

/** Quản lý API key cho iOS Shortcut: tạo (hiện 1 lần), xem lần dùng cuối, thu hồi. */
export function ApiKeysSection() {
  const keys = useApiKeys()
  const revoke = useRevokeApiKey()
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)

  const activeCount = keys.data?.filter((k) => k.revokedAt === null).length ?? 0
  const atLimit = activeCount >= MAX_ACTIVE_API_KEYS

  async function confirmRevoke() {
    if (!revoking) return
    try {
      await revoke.mutateAsync(revoking.id)
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Không thu hồi được key.')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">API key cho iOS Shortcut</h2>
            <p className="body-sm text-muted-foreground">
              Shortcut gửi thông báo ngân hàng kèm key để giao dịch vào đúng tài khoản của bạn.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => setCreating(true)} disabled={atLimit || keys.isPending}>
          <Plus className="h-4 w-4" /> Tạo key
        </Button>
      </div>

      {atLimit && (
        <p className="mt-3 text-sm text-muted-foreground">Đã đủ {MAX_ACTIVE_API_KEYS} key còn hiệu lực — thu hồi bớt để tạo mới.</p>
      )}

      <div className="mt-4">
        {keys.isPending && <p className="text-sm text-muted-foreground">Đang tải…</p>}
        {keys.isError && (
          <p role="alert" className="text-sm text-destructive">
            {keys.error.message}{' '}
            <button type="button" className="underline" onClick={() => keys.refetch()}>Thử lại</button>
          </p>
        )}
        {keys.isSuccess && keys.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có key nào. Tạo key rồi dán vào Shortcut trên iPhone.</p>
        )}
        {keys.isSuccess && keys.data.length > 0 && (
          <ul className="divide-y">
            {keys.data.map((k) => <ApiKeyRow key={k.id} apiKey={k} onRevoke={setRevoking} />)}
          </ul>
        )}
      </div>

      <CreateApiKeyDialog open={creating} onOpenChange={setCreating} />

      <AlertDialog open={revoking !== null} onOpenChange={(open) => { if (!open) setRevoking(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thu hồi key “{revoking?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Shortcut đang dùng key này sẽ bị từ chối ngay. Thu hồi là vĩnh viễn, không bật lại được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevoke}>Thu hồi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
