import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/form/FormField'
import { describedBy } from '@/components/form/form-aria'
import { Input } from '@/components/ui/input'
import { useCreateApiKey } from '@/hooks/useApiKeys'
import { getErrorMessage } from '@/services/api-errors'

/** Endpoint Shortcut gọi tới — hiện kèm key để user dán thẳng vào Shortcut. */
export const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-transaction`

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Trình duyệt chặn clipboard (http, quyền) — user vẫn chọn chữ copy tay được.
      setCopied(false)
    }
  }
  return (
    <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={label}>
      {copied ? <Check className="h-4 w-4 text-income" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

/** Bước 1: đặt tên. Bước 2: hiện key ĐÚNG MỘT LẦN — đóng dialog là không xem lại được. */
function CreateKeyBody({ onDone, setBusy, onKeyShown }: {
  onDone: () => void
  setBusy: (b: boolean) => void
  /** Báo dialog cha khoá Esc / nút X / click ngoài trong lúc key đang hiện. */
  onKeyShown: () => void
}) {
  const create = useCreateApiKey()
  const [name, setName] = useState('iPhone')
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (create.isPending) return
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 50) {
      setError('Tên key 1–50 ký tự.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      setKey(await create.mutateAsync(trimmed))
      onKeyShown()
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được key. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  if (key) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Key “{name.trim()}” đã tạo</DialogTitle>
          <DialogDescription>
            Sao chép ngay — key chỉ hiện <strong>một lần</strong>. Mất key thì thu hồi và tạo key mới.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label htmlFor="new-api-key" className="font-medium">API key</label>
            <div className="flex gap-2">
              <Input id="new-api-key" readOnly value={key} className="font-mono" onFocus={(e) => e.target.select()} />
              <CopyButton value={key} label="Sao chép key" />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="ingest-url" className="font-medium">URL trong Shortcut</label>
            <div className="flex gap-2">
              <Input id="ingest-url" readOnly value={INGEST_URL} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <CopyButton value={INGEST_URL} label="Sao chép URL" />
            </div>
          </div>
          <p className="text-muted-foreground">
            Trong Shortcut, thêm header <code className="font-mono">Authorization</code> với giá trị{' '}
            <code className="font-mono">Bearer &lt;key&gt;</code>.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onDone}>Tôi đã lưu key</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Tạo API key</DialogTitle>
        <DialogDescription>Mỗi thiết bị/Shortcut nên dùng một key riêng để thu hồi riêng khi cần.</DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <FormField id="api-key-name" label="Tên key" hint="Ví dụ: iPhone, iPad của vợ" error={error ?? undefined}>
          <Input
            id="api-key-name" value={name} maxLength={50} autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy('api-key-name', Boolean(error))}
            onChange={(e) => { setName(e.target.value); setError(null) }}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={create.isPending}>Huỷ</Button>
        <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Đang tạo…' : 'Tạo key'}</Button>
      </DialogFooter>
    </form>
  )
}

export function CreateApiKeyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  // Key đang hiện: chỉ nút "Tôi đã lưu key" đóng được. Esc, nút X, click ngoài mà lỡ
  // tay là mất key vĩnh viễn (DB chỉ giữ hash).
  const [keyShown, setKeyShown] = useState(false)
  const close = () => { setKeyShown(false); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy && !keyShown) onOpenChange(next) }}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { if (keyShown) e.preventDefault() }}
      >
        {open && <CreateKeyBody setBusy={setBusy} onKeyShown={() => setKeyShown(true)} onDone={close} />}
      </DialogContent>
    </Dialog>
  )
}
