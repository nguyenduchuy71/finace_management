/**
 * Khoá gốc của mọi query — một nguồn duy nhất để gõ sai tên không âm thầm làm hỏng invalidate.
 * Mỗi hook vẫn tự quyết tập khoá cần tải lại (các tập đó khác nhau có chủ đích).
 * `creditCardTransactions` là tiền tố BẮT BUỘC của mọi query giao dịch thẻ (kể cả "Nhiều thẻ").
 */
export const QK = {
  accounts: ['accounts'],
  transactions: ['transactions'],
  creditCards: ['creditCards'],
  creditCardTransactions: ['creditCardTransactions'],
  cardCycleExpenses: ['cardCycleExpenses'],
  cashbackRules: ['cashbackRules'],
  dashboardStats: ['dashboardStats'],
  unparsedMessages: ['unparsedMessages'],
  creditCardTxCount: ['creditCardTxCount'],
  accountTxCount: ['accountTxCount'],
  apiKeys: ['apiKeys'],
  userSettings: ['userSettings'],
  credits: ['credits'],
  admin: ['admin'],
} as const
