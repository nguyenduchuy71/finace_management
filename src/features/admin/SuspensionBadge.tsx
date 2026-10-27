import { Badge } from '@/components/ui/badge'
import { suspensionState, type AdminUser } from '@/types/admin'

/** Hoạt động / Bị khoá / Lệch (cờ DB và ban GoTrue không cùng chiều — bấm lại thao tác để hoàn tất). */
export function SuspensionBadge({ user }: { user: Pick<AdminUser, 'suspendedAt' | 'bannedUntil'> }) {
  const state = suspensionState(user, new Date().toISOString())
  if (state === 'active') return <Badge variant="secondary">Hoạt động</Badge>
  if (state === 'suspended') return <Badge variant="destructive">Bị khoá</Badge>
  return <Badge variant="outline" className="border-warning">Lệch trạng thái</Badge>
}
