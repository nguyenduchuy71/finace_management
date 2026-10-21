import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Số chạy từ giá trị đang hiện tới `target` (ease-out, mặc định 600ms) — chỉ khi `target` ĐỔI
 * (lần tải đầu, đổi kỳ); refetch nền trả cùng số thì không chạy lại. Người dùng bật giảm chuyển
 * động thì trả ngay giá trị cuối. Luôn là số nguyên (VND không có phần lẻ).
 */
export function useCountUp(target: number, durationMs = 600): number {
  // Giảm chuyển động / tắt animation: trả thẳng target, không đi qua state (không render thừa).
  const animate = !prefersReducedMotion() && durationMs > 0
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (!animate) {
      fromRef.current = target // bật lại animation sau này thì chạy tiếp từ số đang hiện
      return
    }
    // Không thoát sớm khi from === target: effect chỉ chạy lại khi deps đổi (refetch cùng số thì không),
    // và khi vừa bật lại animation thì một khung hình là đủ để state bắt kịp target.
    const from = fromRef.current
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - t) ** 3 // ease-out cubic
      const next = Math.round(from + (target - from) * eased)
      fromRef.current = next
      setValue(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    // Gỡ khi target đổi giữa chừng: lần chạy mới bắt đầu từ số đang hiện, không nhảy cóc.
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, animate])

  return animate ? value : target
}
