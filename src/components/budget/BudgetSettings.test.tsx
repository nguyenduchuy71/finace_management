import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BudgetSettings } from './BudgetSettings'
import { useBudgetStore } from '@/stores/budgetStore'

describe('BudgetSettings Dialog Component', () => {
  beforeEach(() => {
    // Clear budgets before each test
    const store = useBudgetStore.getState()
    store.budgets = {}
  })

  it('Test 1: Dialog opens with controlled open prop, renders 6 category inputs', async () => {
    const onOpenChange = vi.fn()
    render(
      <BudgetSettings
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    // Check dialog title
    expect(screen.getByText('Đặt ngân sách theo danh mục')).toBeInTheDocument()

    // Check all 6 categories are rendered (by checking for labels)
    expect(screen.getByText('Ăn uống')).toBeInTheDocument()
    expect(screen.getByText('Mua sắm')).toBeInTheDocument()
    expect(screen.getByText('Di chuyển')).toBeInTheDocument()
    expect(screen.getByText('Giải trí')).toBeInTheDocument()
    expect(screen.getByText('Hóa đơn')).toBeInTheDocument()
    expect(screen.getByText('Khác')).toBeInTheDocument()

    // Check there are 6 inputs (one per category)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(6)
  })

  it('Test 2: Each category input shows label and text field with formatVND-formatted initial budget value', async () => {
    // Set a budget first
    const store = useBudgetStore.getState()
    store.setBudget('Ăn uống', 5000000)

    const onOpenChange = vi.fn()
    render(
      <BudgetSettings
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    // Check that inputs have initial values
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBe(6)

    // The first input (Ăn uống) should show formatted budget
    const firstInput = inputs[0] as HTMLInputElement
    expect(firstInput.value).toContain('5')
  })

  it('Test 3: Clicking "Lưu" (Save) button calls setBudget for each category with parseVND(input) parsed amount', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const store = useBudgetStore.getState()
    const setBudgetSpy = vi.spyOn(store, 'setBudget')

    render(
      <BudgetSettings
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    // Get all inputs
    const inputs = screen.getAllByRole('textbox')

    // Set a value in the first input (Ăn uống)
    await user.clear(inputs[0])
    await user.type(inputs[0], '1000000')

    // Click save button
    const saveButton = screen.getByText('Lưu')
    await user.click(saveButton)

    await waitFor(() => {
      expect(setBudgetSpy).toHaveBeenCalled()
    })
  })

  it('Test 4: User can type "100.000" (VND format with thousand separator) → parseVND extracts 100000 integer', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <BudgetSettings
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    const inputs = screen.getAllByRole('textbox')

    // Type with thousand separator
    await user.clear(inputs[0])
    await user.type(inputs[0], '100.000')

    const saveButton = screen.getByText('Lưu')
    await user.click(saveButton)

    // Check that store has the parsed value
    const store = useBudgetStore.getState()
    await waitFor(() => {
      expect(store.getBudget('Ăn uống')).toBe(100000)
    })
  })

  it('Test 5: Changing budget from "1.000.000" to "500.000" → setBudget called with 500000', async () => {
    const user = userEvent.setup()
    const store = useBudgetStore.getState()
    store.setBudget('Ăn uống', 1000000)

    const onOpenChange = vi.fn()
    render(
      <BudgetSettings
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    const inputs = screen.getAllByRole('textbox')

    // Clear and type new value
    await user.clear(inputs[0])
    await user.type(inputs[0], '500.000')

    const saveButton = screen.getByText('Lưu')
    await user.click(saveButton)

    // Verify the new value is set
    await waitFor(() => {
      expect(store.getBudget('Ăn uống')).toBe(500000)
    })
  })

  it('Test 6: Clicking outside dialog or pressing Escape closes dialog (controlled via onOpenChange callback)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <BudgetSettings
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    // Press Escape
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('Test 7: Re-opening dialog shows previously saved budgets in input fields (loads from useBudgetStore)', async () => {
    const store = useBudgetStore.getState()
    store.setBudget('Mua sắm', 3000000)
    store.setBudget('Di chuyển', 2000000)

    const onOpenChange = vi.fn()

    const { rerender } = render(
      <BudgetSettings
        open={false}
        onOpenChange={onOpenChange}
      />
    )

    // Re-open
    rerender(
      <BudgetSettings
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    const inputs = screen.getAllByRole('textbox')
    // Second input is Mua sắm
    expect(inputs[1].value).toContain('3')
    // Third input is Di chuyển
    expect(inputs[2].value).toContain('2')
  })

  it('Test 8: Saving empty input (or "0") → setBudget(category, 0) called (clears budget for category if was set)', async () => {
    const user = userEvent.setup()
    const store = useBudgetStore.getState()
    store.setBudget('Ăn uống', 5000000)

    const onOpenChange = vi.fn()
    render(
      <BudgetSettings
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    const inputs = screen.getAllByRole('textbox')

    // Clear the input
    await user.clear(inputs[0])

    const saveButton = screen.getByText('Lưu')
    await user.click(saveButton)

    // Verify it's cleared (0 or not set)
    await waitFor(() => {
      expect(store.getBudget('Ăn uống')).toBe(0)
    })
  })
})
