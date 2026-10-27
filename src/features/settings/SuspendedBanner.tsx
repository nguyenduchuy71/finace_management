import { TriangleAlert } from 'lucide-react'
import { useUserSettings } from '@/hooks/useUserSettings'

/**
 * Báo user đang bị admin khoá. Khi khoá, policy RLS restrictive làm mọi bảng dữ liệu trả RỖNG
 * (không lỗi) — thiếu banner này user thấy app trống và tưởng mất dữ liệu. `user_settings` cố ý
 * không gắn policy đó nên vẫn đọc được cờ khoá.
 */
export function SuspendedBanner() {
  const settings = useUserSettings()
  if (!settings.data?.suspendedAt) return null
  return (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-warning bg-card p-4 text-sm text-foreground">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p>
        <strong>Tài khoản đang bị tạm khoá.</strong> Dữ liệu của bạn vẫn được giữ nguyên nhưng tạm thời không xem
        hoặc ghi được, và Shortcut sẽ bị từ chối. Liên hệ quản trị để được mở khoá.
      </p>
    </div>
  )
}
