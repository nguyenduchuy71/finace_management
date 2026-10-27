import { describe, it, expect } from 'vitest'
import type { Transaction } from '@/types/account'
import type { ChatMessage } from '@/stores/chatStore'
import { buildSystemPrompt, regenerateTurns } from './chat-context'

const noFilters = { accountId: null, dateFrom: null, dateTo: null, txType: 'all', searchQuery: '' }
const msg = (role: ChatMessage['role'], content: string): ChatMessage => ({ id: content, role, content, timestamp: 0 })

describe('buildSystemPrompt', () => {
  it('ghi ngày theo giờ Việt Nam, không phải ngày UTC', () => {
    // 20:30 UTC ngày 1 = 03:30 sáng ngày 2 ở Việt Nam
    const tx = { id: '1', transactionDate: '2026-01-01T20:30:00Z', description: 'Phở', amount: -50000, type: 'expense' } as Transaction
    expect(buildSystemPrompt([tx], noFilters)).toContain('- 02/01/2026: Phở | - đ 50.000')
  })

  it('không có giao dịch -> câu báo trống', () => {
    expect(buildSystemPrompt([], noFilters)).toContain('Không có giao dịch nào trong bộ lọc hiện tại.')
  })
})

describe('regenerateTurns', () => {
  it('cắt tới tin user cuối, bỏ tin lỗi', () => {
    const turns = regenerateTurns([msg('user', 'a'), msg('assistant', 'b'), msg('user', 'c'), msg('error', 'x')])
    expect(turns).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ])
  })

  it('chưa có tin user -> null', () => {
    expect(regenerateTurns([msg('assistant', 'b')])).toBeNull()
  })
})
