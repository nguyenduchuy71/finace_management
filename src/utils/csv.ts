import { formatVND } from './currency'
import { formatDisplayDate } from './dates'
import type { Transaction } from '@/types/account'
import type { CreditCardTransaction } from '@/types/creditCard'
import type { BankAccount } from '@/types/account'
import type { CreditCard } from '@/types/creditCard'

export interface CSVTransactionRow {
  'Ngày': string
  'Mô tả': string
  'Số tiền': string
  'Loại': string
  'Tài khoản': string
  'Danh mục': string
}

/**
 * Transform a Transaction or CreditCardTransaction to a CSV row with Vietnamese headers.
 * @param tx Transaction or CreditCardTransaction object
 * @param accountOrCard Optional BankAccount or CreditCard for account/card name
 * @param categoryOverrides Optional Map of transaction ID to category override
 */
export function formatTransactionForCSV(
  tx: Transaction | CreditCardTransaction,
  accountOrCard?: BankAccount | CreditCard,
  categoryOverrides?: Map<string, string>
): CSVTransactionRow {
  const isBankAccount = accountOrCard && 'accountName' in accountOrCard
  const accountName = isBankAccount
    ? (accountOrCard as BankAccount).accountName
    : accountOrCard && 'cardName' in accountOrCard
      ? (accountOrCard as CreditCard).cardName
      : 'N/A'

  // Map transaction type to Vietnamese label
  const typeLabel = tx.type === 'income' || tx.type === 'payment' ? 'Thu nhập' : 'Chi tiêu'

  // Get category from overrides or original transaction
  const category = categoryOverrides?.get(tx.id) ?? tx.category ?? 'Khác'

  return {
    'Ngày': formatDisplayDate(tx.transactionDate),
    'Mô tả': tx.description,
    'Số tiền': formatVND(Math.abs(tx.amount)),
    'Loại': typeLabel,
    'Tài khoản': accountName,
    'Danh mục': category,
  }
}

/**
 * Download a CSV string as a file with UTF-8 BOM for Excel compatibility.
 * @param csvString Comma-separated values (typically from Papa.unparse)
 * @param filename Name for the downloaded file
 */
export function downloadCSV(csvString: string, filename: string): void {
  // Prepend UTF-8 BOM for Excel compatibility
  const csvWithBOM = '\ufeff' + csvString

  // Create Blob with CSV MIME type
  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8' })

  // Create temporary download link
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename

  // Trigger download
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  // Clean up Blob URL
  URL.revokeObjectURL(url)
}
