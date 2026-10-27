import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useUpdateOwnerNames, useUserSettings } from '@/hooks/useUserSettings'
import { normalizeOwnerNames } from '@/services/user-settings'
import { MAX_OWNER_NAMES, OWNER_NAME_LENGTH } from '@/types/api-key'
import { getErrorMessage } from '@/services/api-errors'
import { Textarea } from '@/components/ui/textarea'

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
    const { min, max } = OWNER_NAME_LENGTH
    const bad = names.find((n) => n.length < min || n.length > max)
    if (bad !== undefined) {
      setError(`Mỗi tên ${min}–${max} ký tự (“${bad.slice(0, 30)}”).`)
      return
    }
    setError(null)
    try {
      await update.mutateAsync(names)
    } catch (err) {
      setError(getErrorMessage(err, 'Không lưu được. Vui lòng thử lại.'))
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-2">
      <label htmlFor="owner-names" className="text-sm font-medium">Tên chủ tài khoản (mỗi dòng một tên)</label>
      <Textarea
        id="owner-names" rows={3} value={text} spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'owner-names-error' : 'owner-names-hint'}
        onChange={(e) => { setText(e.target.value); setError(null) }}
        className="font-mono"
        placeholder="NGUYEN VAN A"
      />
      {error
        ? <p id="owner-names-error" role="alert" className="text-xs text-destructive">{error}</p>
        : <p id="owner-names-hint" className="text-xs text-muted-foreground">
            Có dấu hay không dấu, hoa hay thường đều được. Chỉ áp cho giao dịch nhận từ bây giờ.
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
