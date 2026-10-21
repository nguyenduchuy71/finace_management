export interface NetFlow {
  /** Thu − chi trong kỳ (âm = chi vượt thu). */
  net: number
  /** Chi chiếm bao nhiêu % số thu, làm tròn; null khi kỳ không có thu (không chia cho 0). */
  spendRatio: number | null
}

/**
 * Dòng tiền ròng từ tổng thu/chi của dashboard. Cả hai tham số là số DƯƠNG như RPC
 * `get_dashboard_stats` trả về (totalExpense = |tổng chi|), đã loại chuyển nội bộ.
 */
export function computeNetFlow(totalIncome: number, totalExpense: number): NetFlow {
  return {
    net: totalIncome - totalExpense,
    spendRatio: totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : null,
  }
}
