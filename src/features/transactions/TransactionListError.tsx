import { AlertCircle } from 'lucide-react'
import { getErrorMessage } from '@/services/api-errors'

interface TransactionListErrorProps {
  title: string
  error: unknown
}

/** Trạng thái lỗi dùng chung cho các danh sách giao dịch. `role="alert"` để trình đọc màn hình báo ngay. */
export function TransactionListError({ title, error }: TransactionListErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center p-10 text-center">
      <AlertCircle className="h-8 w-8 text-destructive mb-3" />
      <p className="font-medium text-destructive">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">
        {getErrorMessage(error, 'Đã có lỗi xảy ra. Vui lòng thử lại.')}
      </p>
    </div>
  )
}
