import { useEffect, useState } from 'react'

/**
 * Thời điểm hiện tại (ISO UTC) tự cập nhật mỗi `intervalMs`.
 *
 * Tab để mở qua mốc cắt sao kê hoặc qua nửa đêm thì chu kỳ hiển thị và khoản hoàn tiền ước
 * tính phải sang chu kỳ mới. Chốt `now` một lần lúc mount làm chúng kẹt ở chu kỳ cũ: giao
 * dịch đến sau mốc cắt không bao giờ xuất hiện trong ước tính cho tới khi tải lại trang.
 */
export function useNow(intervalMs = 60_000): string {
  const [now, setNow] = useState(() => new Date().toISOString())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
