import { BankAccountSchema, TransactionSchema } from '@/types/account'
import { CreditCardSchema, CreditCardTransactionSchema } from '@/types/creditCard'

/** Row của bảng `transactions` (snake_case, như PostgREST trả về). */
export interface TransactionRow {
  id: string
  bank_name: string
  amount: number | string   // bigint có thể về dạng string tuỳ driver
  currency: string
  transaction_date: string
  description: string | null
  raw_text: string | null
  created_at: string
  user_id: string | null
  source_type: 'bank' | 'credit_card' | null
  account_ref: string | null
  account_id: string | null
  card_id: string | null
  merchant_name: string | null
  category: string | null
  mcc?: string | null
  kind?: 'normal' | 'internal_transfer' | 'cashback'
  status: 'pending' | 'posted'
}

export interface AccountRow {
  id: string
  bank_name: string
  account_name: string
  account_number: string
  account_type: 'checking' | 'savings'
  currency: string
  balance: number | string
  last_updated: string
}

export interface CreditCardRow {
  id: string
  bank_name: string
  card_name: string
  card_number: string
  card_type: 'visa' | 'mastercard' | 'jcb' | 'amex'
  currency: string
  credit_limit: number | string
  current_balance: number | string
  statement_date: number
  payment_due_date: number
  cashback_monthly_cap?: number | string | null
  last_updated: string
}

/** bigint/numeric của Postgres có thể về dạng string; VND < 2^53 nên Number() an toàn. */
const toInt = (v: number | string): number => Math.round(Number(v))

/**
 * Chuẩn hoá timestamptz của Postgres về ISO-8601 dạng `Z`.
 *
 * PostgREST trả "2026-08-05T03:00:00+00:00" nhưng Zod `.datetime()` chỉ chấp nhận
 * hậu tố `Z`, nên parse thẳng sẽ fail "Invalid ISO datetime".
 * Frontend đã coi mọi timestamp là UTC rồi đổi sang giờ VN khi hiển thị
 * (utils/dates.ts), nên toISOString() giữ nguyên đúng thời điểm.
 */
const toISO = (v: string): string => new Date(v).toISOString()

export function mapTransaction(row: TransactionRow) {
  const amount = toInt(row.amount)
  // account_id không bao giờ null ở đây: getTransactions luôn lọc
  // .eq('account_id', ...) nên row chưa resolve FK không thể lọt vào.
  // Dùng '' làm fallback để Zod bắt được ngay nếu giả định này sai.
  return TransactionSchema.parse({
    id: row.id,
    accountId: row.account_id ?? '',
    amount,
    description: row.description ?? '',
    merchantName: row.merchant_name ?? undefined,
    category: row.category ?? undefined,
    kind: row.kind,
    type: amount >= 0 ? 'income' : 'expense',
    status: row.status,
    transactionDate: toISO(row.transaction_date),
  })
}

export function mapCreditCardTransaction(row: TransactionRow) {
  const amount = toInt(row.amount)
  return CreditCardTransactionSchema.parse({
    id: row.id,
    cardId: row.card_id ?? '',
    amount,
    description: row.description ?? '',
    merchantName: row.merchant_name ?? row.description ?? '',
    category: row.category ?? undefined,
    mcc: row.mcc ?? undefined,
    kind: row.kind,
    // Parser chỉ suy được purchase; tiền vào thẻ = thanh toán dư nợ.
    type: amount > 0 ? 'payment' : 'purchase',
    status: row.status,
    transactionDate: toISO(row.transaction_date),
    // billingCycleStart/End không lưu DB — utils/billingCycle.ts tự tính từ statement_date.
  })
}

export function mapAccount(row: AccountRow) {
  return BankAccountSchema.parse({
    id: row.id,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    accountType: row.account_type,
    currency: row.currency,
    balance: toInt(row.balance),
    lastUpdated: toISO(row.last_updated),
  })
}

export function mapCreditCard(row: CreditCardRow) {
  return CreditCardSchema.parse({
    id: row.id,
    bankName: row.bank_name,
    cardName: row.card_name,
    cardNumber: row.card_number,
    cardType: row.card_type,
    currency: row.currency,
    creditLimit: toInt(row.credit_limit),
    currentBalance: toInt(row.current_balance),
    statementDate: row.statement_date,
    paymentDueDate: row.payment_due_date,
    cashbackMonthlyCap: row.cashback_monthly_cap == null ? null : toInt(row.cashback_monthly_cap),
    lastUpdated: toISO(row.last_updated),
  })
}
