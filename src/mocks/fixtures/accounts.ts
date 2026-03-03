import type { BankAccount } from '@/types/account'

export const mockAccounts: BankAccount[] = [
  {
    id: 'vcb-checking-001',
    bankName: 'Vietcombank',
    accountName: 'Tài khoản thanh toán',
    accountNumber: '****1234',
    accountType: 'checking',
    currency: 'VND',
    balance: 15_750_000,
    lastUpdated: '2026-02-28T01:00:00Z', // 08:00 Vietnam UTC+7
  },
  {
    id: 'tcb-saving-001',
    bankName: 'Techcombank',
    accountName: 'Tài khoản tiết kiệm',
    accountNumber: '****5678',
    accountType: 'savings',
    currency: 'VND',
    balance: 42_000_000,
    lastUpdated: '2026-02-28T01:00:00Z',
  },
]
