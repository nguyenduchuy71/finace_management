/**
 * Phần trăm thời gian đã trôi qua của chu kỳ `[startISO, endISO)` tại `nowISO`, kẹp 0..100 và làm tròn.
 * `now` nằm ngoài chu kỳ (đồng hồ lệch, tab mở qua mốc cắt trước khi chu kỳ được tính lại) cho 0 hoặc 100
 * thay vì số âm / > 100 làm vỡ thanh tiến độ.
 */
export function cycleProgressPercent(startISO: string, endISO: string, nowISO: string): number {
  const start = Date.parse(startISO)
  const end = Date.parse(endISO)
  const now = Date.parse(nowISO)
  if (!(end > start)) return 0
  const pct = ((now - start) / (end - start)) * 100
  return Math.round(Math.min(100, Math.max(0, pct)))
}

export type CycleUrgency = 'calm' | 'soon' | 'urgent'

/** Mức gấp của kỳ theo số ngày còn lại — ngưỡng giữ như badge cũ: ≤ 3 gấp, ≤ 7 sắp tới. */
export function cycleUrgency(daysUntilClose: number): CycleUrgency {
  if (daysUntilClose <= 3) return 'urgent'
  if (daysUntilClose <= 7) return 'soon'
  return 'calm'
}
