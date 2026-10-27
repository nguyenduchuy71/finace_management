import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAdminUsers } from '@/hooks/useAdmin'
import { formatDisplayDate } from '@/utils/dates'
import { formatParseRate, type AdminUser } from '@/types/admin'
import { SuspensionBadge } from './SuspensionBadge'
import { AdminUserDialog } from './AdminUserDialog'

/** < 200 user: tải 1 lần, lọc ở client (không phân trang). */
export function AdminUsersList() {
  const users = useAdminUsers()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminUser | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = users.data ?? []
    return q ? all.filter((u) => (u.email ?? '').toLowerCase().includes(q)) : all
  }, [users.data, search])

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">
          User {users.isSuccess && <span className="text-muted-foreground">({users.data.length})</span>}
        </h2>
        <div className="w-full sm:w-64">
          <label htmlFor="admin-search" className="sr-only">Tìm theo email</label>
          <Input id="admin-search" type="search" placeholder="Tìm theo email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="mt-4">
        {users.isPending && <p className="text-sm text-muted-foreground">Đang tải…</p>}
        {users.isError && (
          <p role="alert" className="text-sm text-destructive">
            {users.error.message}{' '}
            <button type="button" className="underline" onClick={() => users.refetch()}>Thử lại</button>
          </p>
        )}
        {users.isSuccess && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">{search ? 'Không có user khớp.' : 'Chưa có user.'}</p>
        )}
        {users.isSuccess && filtered.length > 0 && (
          <ul className="divide-y">
            {filtered.map((u) => (
              <li key={u.id}>
                <button
                  type="button" onClick={() => setSelected(u)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md px-1 py-3 text-left hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {u.email ?? u.id}{u.isAdmin && <span className="ml-2 text-xs text-primary">quản trị</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Đăng ký {formatDisplayDate(u.createdAt)} ·{' '}
                      {u.lastSignInAt ? `đăng nhập ${formatDisplayDate(u.lastSignInAt)}` : 'chưa đăng nhập'} ·{' '}
                      {u.keysActive} key · <span className="money">{u.txCount30d}</span> giao dịch/30 ngày ·
                      parse {formatParseRate(u.parseRate30d)}
                    </span>
                  </span>
                  <SuspensionBadge user={u} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdminUserDialog user={selected} onClose={() => setSelected(null)} />
    </Card>
  )
}
