import { screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/** Mở MccPicker có nhãn `label`, gõ `query` vào ô tìm rồi chọn option khớp `option`. */
export async function pickMcc(u: UserEvent, label: string | RegExp, query: string, option: RegExp) {
  await u.click(screen.getByLabelText(label))
  await u.type(screen.getByLabelText('Tìm MCC'), query)
  await u.click(screen.getByRole('option', { name: option }))
}
