import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCreatePayment, usePackages, useProviders } from '@/hooks/usePayments'
import { getErrorMessage } from '@/services/api-errors'
import { formatVND } from '@/utils/currency'
import { PROVIDER_LABEL, type PaymentProvider } from '@/types/payment'

/** Nút radio dạng thẻ (fieldset + legend để đọc màn hình hiểu nhóm). */
function RadioCard({ name, value, checked, onChange, children }: {
  name: string; value: string; checked: boolean; onChange: () => void; children: React.ReactNode
}) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm ${checked ? 'border-primary bg-primary/5' : ''}`}>
      <span className="flex items-center gap-2">
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="accent-[var(--primary)]" />
        {children}
      </span>
    </label>
  )
}

function BuyBody({ onClose }: { onClose: () => void }) {
  const packages = usePackages()
  const providers = useProviders()
  const create = useCreatePayment()
  const [pkgId, setPkgId] = useState<string | null>(null)
  const [provider, setProvider] = useState<PaymentProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pkgId || !provider || create.isPending) return
    setError(null)
    try {
      const { payUrl } = await create.mutateAsync({ provider, packageId: pkgId })
      window.location.assign(payUrl)
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được đơn. Vui lòng thử lại.'))
    }
  }

  const loadError = packages.error ?? providers.error
  const noProvider = providers.isSuccess && providers.data.length === 0
  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Nạp credit</DialogTitle>
        <DialogDescription>Chọn gói và ví. Credit được cộng ngay khi ví xác nhận thanh toán (thường dưới 10 giây).</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {loadError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(loadError, 'Không tải được danh sách gói.')}</p>}
        {(packages.isPending || providers.isPending) && !loadError && <p className="text-sm text-muted-foreground">Đang tải…</p>}
        {packages.isSuccess && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Gói credit</legend>
            {packages.data.length === 0 && <p className="text-sm text-muted-foreground">Hiện chưa có gói nào được bán.</p>}
            {packages.data.map((p) => (
              <RadioCard key={p.id} name="package" value={p.id} checked={pkgId === p.id} onChange={() => setPkgId(p.id)}>
                <span className="money font-medium">{p.credits.toLocaleString('vi-VN')} credit</span>
                <span className="money ml-auto text-muted-foreground">{formatVND(p.priceVnd)}</span>
              </RadioCard>
            ))}
          </fieldset>
        )}
        {providers.isSuccess && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Thanh toán bằng</legend>
            {noProvider && <p className="text-sm text-muted-foreground">Chưa có ví nào được mở. Vui lòng quay lại sau.</p>}
            {providers.data.map((p) => (
              <RadioCard key={p} name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)}>
                {PROVIDER_LABEL[p]}
              </RadioCard>
            ))}
          </fieldset>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>Huỷ</Button>
        <Button type="submit" disabled={!pkgId || !provider || create.isPending}>
          {create.isPending ? 'Đang chuyển tới ví…' : 'Thanh toán'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Nút "Nạp credit" + dialog chọn gói/ví; thành công thì chuyển cả trang tới `pay_url` của ví. */
export function BuyCreditsDialog() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>Nạp credit</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">{open && <BuyBody onClose={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  )
}
