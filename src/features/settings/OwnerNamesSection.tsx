import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useUpdateOwnerNames, useUserSettings } from '@/hooks/useUserSettings'
import { normalizeOwnerNames } from '@/services/user-settings'
import { MAX_OWNER_NAMES } from '@/types/api-key'
import type { ApiError } from '@/types/api'

/** Textarea mỗi dòng một tên; key = dữ liệu đã lưu nên lưu xong form tự đồng bộ. */
function OwnerNamesForm({ saved }: { saved: string[] }) {
  const update = useUpdateOwnerNames()
  const [text, setText] = useState(saved.join('\n'))
  const [error, setError] = useState<string | null>(null)

  const names = normalizeOwnerNames(text.split('\n'))
  const dirty = names.join('\n') !== saved.join('\n')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (names.length > MAX_OWNER_NAMES) {
      setError(`Tối đa ${MAX_OWNER_NAMES} tên.`)
      return
    }
    setError(null)
    try {
      await update.mutateAsync(names)
    } catch (err) {
      setError((err as ApiError).message ?? 'Không lưu được. Vui lòng thử lại.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-2">
      <label htmlFor="owner-names" className="text-sm font-medium">Tên chủ tài khoản (mỗi dòng một tên)</label>
      <textarea
        id="owner-names" rows={3} value={text} spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'owner-names-error' : 'owner-names-hint'}
        onChange={(e) => { setText(e.target.value); setError(null) }}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
        placeholder="NGUYEN VAN A"
      />
      {error
        ? <p id="owner-names-error" role="alert" className="text-xs text-destructive">{error}</p>
        : <p id="owner-names-hint" className="text-xs text-muted-foreground">
            Viết như trên thông báo ngân hàng (thường là chữ in hoa không dấu). Chỉ áp cho giao dịch nhận từ bây giờ.
          </p>}
      <Button type="submit" size="sm" disabled={!dirty || update.isPending}>
        {update.isPending ? 'Đang lưu…' : 'Lưu'}
      </Button>
    </form>
  )
}

/** Tên chủ TK để nhận diện chuyển khoản giữa các TK/thẻ của chính user (không tính vào thu/chi). */
export function OwnerNamesSection() {
  const settings = useUserSettings()
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <UserRound className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Nhận diện chuyển khoản nội bộ</h2>
          <p className="body-sm text-muted-foreground">
            Chuyển tiền giữa các tài khoản mang tên bạn được gắn “Nội bộ” và không tính vào thu/chi.
          </p>
        </div>
      </div>
      {settings.isPending && <p className="mt-4 text-sm text-muted-foreground">Đang tải…</p>}
      {settings.isError && <p role="alert" className="mt-4 text-sm text-destructive">{settings.error.message}</p>}
      {settings.isSuccess && (
        <OwnerNamesForm key={settings.data.ownerNames.join('\n')} saved={settings.data.ownerNames} />
      )}
    </Card>
  )
}
