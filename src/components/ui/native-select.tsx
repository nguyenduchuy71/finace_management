import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * `<select>` gốc mang giao diện giống `Input`. Giữ select gốc (không dùng Radix Select) vì picker
 * gốc của iOS/Android dễ dùng hơn trên điện thoại. Nền phải ĐẶC: Chrome vẽ danh sách lựa chọn bằng
 * màu nền của select, nền trong suốt + chữ sáng ở theme tối = chữ sáng trên nền trắng.
 */
function NativeSelect({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" }) {
  return (
    <div
      data-slot="native-select-wrapper"
      className={cn("relative w-full", className)}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "w-full min-w-0 cursor-pointer appearance-none rounded-md border border-input bg-background py-1 pr-9 pl-3 text-base text-foreground shadow-xs transition-[color,box-shadow] outline-none md:text-sm dark:bg-card",
          "data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=sm]:pr-8 data-[size=sm]:pl-2.5 data-[size=sm]:text-xs",
          "hover:border-ring/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50 aria-busy:opacity-60",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "[&_option]:bg-popover [&_option]:text-popover-foreground [&_option:disabled]:text-muted-foreground [&_optgroup]:bg-popover [&_optgroup]:text-muted-foreground",
        )}
        {...props}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          size === "sm" ? "right-2.5 size-3.5" : "right-3 size-4",
        )}
      />
    </div>
  )
}

export { NativeSelect }
