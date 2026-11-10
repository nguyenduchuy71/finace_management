import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MeterBar } from '@/components/ui/MeterBar'
import { APP_NAME } from '@/components/layout/BrandMark'
import { CreateApiKeyDialog } from '@/features/settings/CreateApiKeyDialog'
import { useAuth } from '@/hooks/useAuth'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { readString, writeString } from '@/lib/persisted-json'
import { cn } from '@/lib/utils'

/** Ẩn theo từng user trên trình duyệt này (tiện lợi, không phải dữ liệu cần bền vững). */
const dismissKey = (userId: string) => `setup-checklist-dismissed:${userId}`

interface Step {
  done: boolean
  title: string
  hint: string
  action?: React.ReactNode
}

/**
 * Hướng dẫn bắt đầu cho user mới: thêm TK/thẻ → tạo API key cho Shortcut → nhận tin đầu tiên.
 * Tự biến mất khi đã có tin đầu tiên (tức là đã thiết lập xong — kể cả chủ app dùng đường legacy
 * không có API key), hoặc khi user bấm Ẩn.
 */
export function SetupChecklist() {
  const userId = useAuth().session?.user.id
  const [dismissed, setDismissed] = useState(() => (userId ? readString(dismissKey(userId)) === '1' : false))
  // Đã ẩn / chưa đăng nhập thì không gắn phần thân -> không chạy 4 truy vấn tiến độ
  if (!userId || dismissed) return null
  return (
    <ChecklistBody
      onDismiss={() => {
        writeString(dismissKey(userId), '1')
        setDismissed(true)
      }}
    />
  )
}

function ChecklistBody({ onDismiss }: { onDismiss: () => void }) {
  const { progress } = useSetupProgress()
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)

  if (!progress || progress.hasData) return null

  const steps: Step[] = [
    {
      done: progress.hasSource,
      title: 'Thêm tài khoản ngân hàng hoặc thẻ tín dụng',
      hint: 'Số tài khoản/thẻ khớp 4 ký tự cuối trong tin nhắn để giao dịch tự gắn đúng chỗ.',
      action: (
        <>
          <Button asChild size="sm" variant="outline" className="touch-target"><Link to="/accounts?view=recorded">Thêm tài khoản</Link></Button>
          <Button asChild size="sm" variant="outline" className="touch-target"><Link to="/credit-cards">Thêm thẻ</Link></Button>
        </>
      ),
    },
    {
      done: progress.hasKey,
      title: 'Tạo API key và dán vào iOS Shortcut',
      hint: 'Key hiện đúng một lần, kèm URL và header cần dán vào Shortcut.',
      action: <Button size="sm" className="touch-target" onClick={() => setKeyDialogOpen(true)}>Tạo API key</Button>,
    },
    {
      done: false,
      title: 'Nhận thông báo ngân hàng đầu tiên',
      hint: 'Khi iPhone nhận thông báo ngân hàng, Shortcut gửi về đây — bước này tự đánh dấu xong.',
    },
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <section aria-labelledby="setup-title" className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="setup-title" className="heading-h3">Bắt đầu với {APP_NAME}</h2>
          <p className="body-sm text-muted-foreground">Xong {doneCount}/{steps.length} bước — khoảng 5 phút.</p>
        </div>
        <Button variant="ghost" size="icon" className="touch-target shrink-0" onClick={onDismiss} aria-label="Ẩn hướng dẫn bắt đầu">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <MeterBar className="mt-3" percent={(doneCount / steps.length) * 100} label="Tiến độ thiết lập" />

      <ol className="mt-4 space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                step.done ? 'bg-income-soft text-income' : 'border text-muted-foreground',
              )}
            >
              {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className={cn('heading-label', step.done && 'text-muted-foreground line-through')}>
                {step.title}
                <span className="sr-only">{step.done ? ' — đã xong' : ' — chưa xong'}</span>
              </p>
              {!step.done && <p className="body-sm text-muted-foreground">{step.hint}</p>}
              {!step.done && step.action && <div className="flex flex-wrap gap-2">{step.action}</div>}
            </div>
          </li>
        ))}
      </ol>

      <CreateApiKeyDialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen} />
    </section>
  )
}
