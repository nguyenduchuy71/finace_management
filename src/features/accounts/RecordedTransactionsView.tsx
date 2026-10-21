import { useState } from 'react'
import { AccountTabs } from './AccountTabs'
import { AccountFormDialog } from './AccountFormDialog'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { TransactionList } from '@/features/transactions/TransactionList'
import { FilterBar } from '@/components/filters/FilterBar'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/hooks/useAccounts'
import { useFilterStore } from '@/stores/filterStore'
import { Pencil, Plus, Trash2 } from 'lucide-react'

/** Form đang thêm TK mới, hoặc sửa một TK (theo id); null = đóng. Xem CreditCardsPage. */
type FormMode = { kind: 'create' } | { kind: 'edit'; accountId: string } | null

/** Mục "Đã ghi nhận": quản lý TK ngân hàng + giao dịch của TK đang chọn. */
export function RecordedTransactionsView() {
  const { data, isLoading, isError, refetch } = useAccounts()
  const accountId = useFilterStore((s) => s.accountId)
  const accounts = data?.data ?? []
  const account = accounts.find((a) => a.id === accountId) ?? null

  // Lưu id thay vì object: TK biến mất giữa chừng thì dialog đóng hẳn.
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const editAccount = formMode?.kind === 'edit' ? accounts.find((a) => a.id === formMode.accountId) ?? null : null
  const formOpen = formMode?.kind === 'create' || editAccount !== null
  const deleteTarget = accounts.find((a) => a.id === deleteTargetId) ?? null
  const openCreate = () => setFormMode({ kind: 'create' })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {account && (
          <>
            <Button variant="outline" size="sm" aria-label="Sửa tài khoản đang chọn"
              onClick={() => setFormMode({ kind: 'edit', accountId: account.id })}>
              <Pencil className="h-4 w-4" /> Sửa
            </Button>
            <Button variant="outline" size="sm" aria-label="Xoá tài khoản đang chọn"
              onClick={() => setDeleteTargetId(account.id)}>
              <Trash2 className="h-4 w-4" /> Xoá
            </Button>
          </>
        )}
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Thêm tài khoản</Button>
      </div>

      {isError && !data ? (
        // Lỗi tải KHÔNG được hiện như "chưa có TK": user sẽ bị mời thêm lại TK đã có.
        <div role="alert" className="rounded-lg border border-destructive/40 p-10 text-center">
          <p className="font-medium">Không tải được danh sách tài khoản</p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>Thử lại</Button>
        </div>
      ) : !isLoading && accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Chưa có tài khoản ngân hàng nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thêm tài khoản để giao dịch từ thông báo ngân hàng tự động gắn vào đúng tài khoản.
          </p>
          <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4" /> Thêm tài khoản đầu tiên</Button>
        </div>
      ) : (
        <>
          <AccountTabs />
          <FilterBar />
          <TransactionList />
        </>
      )}

      <AccountFormDialog open={formOpen} account={editAccount}
        onOpenChange={(open) => { if (!open) setFormMode(null) }} />
      <DeleteAccountDialog open={deleteTarget !== null} account={deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }} />
    </div>
  )
}
