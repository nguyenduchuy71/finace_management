import type { ChatMessage } from '@/stores/chatStore'
import type { Transaction } from '@/types/account'
import { formatDisplayDate } from '@/utils/dates'
import { formatVNDSigned } from '@/utils/currency'

export const SYSTEM_PROMPT_BASE = `Bạn là trợ lý tài chính cá nhân cho người dùng Việt Nam. \
Phân tích dữ liệu giao dịch và đưa ra lời khuyên thực tế, ngắn gọn bằng tiếng Việt. \
Sử dụng markdown để định dạng câu trả lời (danh sách, in đậm cho số tiền quan trọng). \
Luôn trả lời bằng tiếng Việt trừ khi người dùng hỏi bằng ngôn ngữ khác.`

/** Số giao dịch tối đa đưa vào system prompt, chặn tràn token. */
export const CHAT_CONTEXT_TX_LIMIT = 20

export interface ChatFilterContext {
  accountId: string | null
  dateFrom: string | null
  dateTo: string | null
  txType: string
  searchQuery: string
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

/**
 * System prompt kèm mẫu giao dịch đang hiển thị. Ngày theo giờ Việt Nam (`formatDisplayDate`):
 * cắt `transactionDate.slice(0, 10)` là ngày UTC, giao dịch 00:00–06:59 bị lùi một ngày.
 */
export function buildSystemPrompt(transactions: Transaction[], filters: ChatFilterContext): string {
  const sample = transactions.slice(0, CHAT_CONTEXT_TX_LIMIT)
  const filterDesc = [
    filters.accountId ? `tài khoản ${filters.accountId}` : null,
    filters.dateFrom ? `từ ${filters.dateFrom}` : null,
    filters.dateTo ? `đến ${filters.dateTo}` : null,
    filters.txType !== 'all' ? `loại ${filters.txType}` : null,
    filters.searchQuery ? `tìm kiếm "${filters.searchQuery}"` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const contextText =
    sample.length > 0
      ? `Dữ liệu ${sample.length} giao dịch${filterDesc ? ` (lọc: ${filterDesc})` : ''}:\n` +
        sample
          .map((tx) => `- ${formatDisplayDate(tx.transactionDate)}: ${tx.merchantName ?? tx.description} | ${formatVNDSigned(tx.amount)}`)
          .join('\n')
      : 'Không có giao dịch nào trong bộ lọc hiện tại.'

  return `${SYSTEM_PROMPT_BASE}\n\n${contextText}`
}

/** Lịch sử gửi Anthropic API: chỉ tin user/assistant (bỏ tin lỗi). */
export function toChatTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter((m): m is ChatMessage & ChatTurn => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }))
}

/**
 * Lịch sử để tạo lại câu trả lời: cắt tới tin user CUỐI CÙNG (bỏ mọi thứ sau nó). `null` khi chưa
 * có tin user nào. Không thêm lại tin user — "Tạo lại" từng nhân đôi câu hỏi cả trong khung chat lẫn API.
 */
export function regenerateTurns(messages: ChatMessage[]): ChatTurn[] | null {
  const turns = toChatTurns(messages)
  const lastUser = turns.map((t) => t.role).lastIndexOf('user')
  return lastUser === -1 ? null : turns.slice(0, lastUser + 1)
}
