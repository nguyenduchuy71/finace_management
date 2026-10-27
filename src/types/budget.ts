import type { Category } from '@/types/categories'

export interface BudgetState {
  budgets: Record<Category, number>
  setBudget: (category: Category, amount: number) => void
}
