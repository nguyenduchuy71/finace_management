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
import { FormField } from '@/components/form/FormField'
import { describedBy } from '@/components/form/form-aria'
import { formatVND } from '@/utils/currency'
import { CATEGORY_TAXONOMY } from '@/utils/categories'
import { moneyAmountField } from '@/types/form-fields'
import type { Category } from '@/types/categories'

// Cùng luật với mọi ô tiền khác: "1.5" không được âm thầm thành 15đ.
const budgetAmount = moneyAmountField('Ngân sách')

interface BudgetSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BudgetSettings({ open, onOpenChange }: BudgetSettingsProps) {
  const { budgets, setBudget } = useBudgetStore()
  const [errors, setErrors] = useState<Partial<Record<Category, string>>>({})

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
    const categories = Object.keys(CATEGORY_TAXONOMY) as Category[]
    const amounts = new Map<Category, number>()
    const nextErrors: Partial<Record<Category, string>> = {}
    for (const category of categories) {
      const parsed = budgetAmount.safeParse(localBudgets[category] ?? '')
      if (parsed.success) amounts.set(category, parsed.data)
      else nextErrors[category] = parsed.error.issues[0]?.message
    }
    setErrors(nextErrors)
    // Một ô sai thì không lưu ô nào: lưu một nửa khiến user tưởng đã lưu hết.
    if (Object.keys(nextErrors).length > 0) return

    // 0 / để trống = không đặt ngân sách (BudgetProgressBar bỏ qua).
    amounts.forEach((amount, category) => setBudget(category, amount))
    onOpenChange(false)
  }

  function handleInputChange(category: Category, value: string) {
    setLocalBudgets((prev) => ({
      ...prev,
      [category]: value,
    }))
    setErrors((prev) => ({ ...prev, [category]: undefined }))
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
          {Object.keys(CATEGORY_TAXONOMY).map((cat, i) => {
            const category = cat as Category
            const id = `budget-${i}`
            const error = errors[category]
            return (
              <FormField key={category} id={id} label={category} error={error}>
                <Input
                  id={id}
                  type="text"
                  inputMode="numeric"
                  placeholder="Nhập ngân sách (VND)"
                  value={localBudgets[category] ?? ''}
                  onChange={(e) => handleInputChange(category, e.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy(id, Boolean(error))}
                  className="text-sm"
                />
              </FormField>
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
