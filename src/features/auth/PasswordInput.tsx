import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Ô mật khẩu có nút hiện/ẩn — gõ trên điện thoại dễ sai mà không thấy.
 * Nhãn của ô vẫn do `<label htmlFor>` bên ngoài đặt; nút có tên riêng ("Hiện mật khẩu").
 */
export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
