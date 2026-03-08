import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useBudgetStore } from '@/stores/budgetStore'
import { formatVND, parseVND } from '@/utils/currency'
import { CATEGORY_TAXONOMY } from '@/utils/categories'
import type { Category } from '@/types/categories'

interface BudgetSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BudgetSettings({ open, onOpenChange }: BudgetSettingsProps) {
  const { budgets, setBudget } = useBudgetStore()

  // Initialize local state with current budgets
  const [localBudgets, setLocalBudgets] = useState<Record<Category, string>>(() => {
    const initial: Record<Category, string> = {} as Record<Category, string>
    Object.keys(CATEGORY_TAXONOMY).forEach((cat) => {
      const category = cat as Category
      const currentBudget = budgets[category] ?? 0
      initial[category] = currentBudget > 0 ? formatVND(currentBudget).replace('đ ', '') : ''
    })
    return initial
  })

  function handleSave() {
    Object.keys(CATEGORY_TAXONOMY).forEach((cat) => {
      const category = cat as Category
      const amount = parseVND(localBudgets[category] ?? '')
      if (amount > 0) {
        setBudget(category, amount)
      } else {
        // If amount is 0 or empty, we could either clear or not set
        // For now, just set to 0 (which the guard in BudgetProgressBar treats as no budget)
        setBudget(category, 0)
      }
    })
    onOpenChange(false)
  }

  function handleInputChange(category: Category, value: string) {
    setLocalBudgets((prev) => ({
      ...prev,
      [category]: value,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Đặt ngân sách theo danh mục</DialogTitle>
          <DialogDescription>
            Nhập ngân sách hàng tháng cho mỗi danh mục chi tiêu
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {Object.keys(CATEGORY_TAXONOMY).map((cat) => {
            const category = cat as Category
            return (
              <div key={category} className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {category}
                </label>
                <Input
                  type="text"
                  placeholder="Nhập ngân sách (VND)"
                  value={localBudgets[category] ?? ''}
                  onChange={(e) => handleInputChange(category, e.target.value)}
                  className="text-sm"
                />
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            size="sm"
            onClick={handleSave}
            className="w-full min-h-[44px]"
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
