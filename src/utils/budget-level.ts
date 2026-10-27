/** Mức cảnh báo ngân sách theo % đã chi — một nguồn cho thanh tiến độ lẫn toast cảnh báo. */
export const BUDGET_WARNING_PERCENT = 80
export const BUDGET_OVER_PERCENT = 100

export type BudgetLevel = 'ok' | 'warning' | 'overbudget'

export function budgetLevel(percent: number): BudgetLevel {
  if (percent >= BUDGET_OVER_PERCENT) return 'overbudget'
  if (percent >= BUDGET_WARNING_PERCENT) return 'warning'
  return 'ok'
}
