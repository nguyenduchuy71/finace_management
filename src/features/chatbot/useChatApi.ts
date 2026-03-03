import { useShallow } from 'zustand/react/shallow'
import { useChatStore } from '@/stores/chatStore'
import { useFilterStore } from '@/stores/filterStore'
import { useTransactions } from '@/hooks/useTransactions'

export function useChatApi() {
  const { apiConfig, addMessage, setLoading, isLoading } = useChatStore()
  const { searchQuery, dateFrom, dateTo, txType, accountId } = useFilterStore(
    useShallow((s) => ({
      searchQuery: s.searchQuery,
      dateFrom: s.dateFrom,
      dateTo: s.dateTo,
      txType: s.txType,
      accountId: s.accountId,
    }))
  )

  // Get current visible transactions for context
  const { data: transactionPages } = useTransactions()
  const visibleTransactions = transactionPages?.pages.flatMap((p) => p.data) ?? []

  async function sendMessage(userText: string) {
    if (!userText.trim() || isLoading) return

    if (!apiConfig?.endpoint || !apiConfig?.apiKey) {
      addMessage({
        role: 'error',
        content:
          'Chưa cấu hình API. Nhấn biểu tượng cài đặt để nhập endpoint và API key.',
      })
      return
    }

    // Add user message immediately
    addMessage({ role: 'user', content: userText })
    setLoading(true)

    // Build transaction context summary (limit to 20 transactions to avoid token overflow)
    const contextSample = visibleTransactions.slice(0, 20)
    const contextText =
      contextSample.length > 0
        ? `Dưới đây là ${contextSample.length} giao dịch hiện tại (lọc theo: tài khoản ${accountId ?? 'tất cả'}${dateFrom ? `, từ ${dateFrom}` : ''}${dateTo ? ` đến ${dateTo}` : ''}${txType !== 'all' ? `, loại ${txType}` : ''}${searchQuery ? `, tìm kiếm "${searchQuery}"` : ''}):\n\n` +
          contextSample
            .map(
              (tx) =>
                `- ${tx.transactionDate.slice(0, 10)}: ${tx.merchantName ?? tx.description} | ${tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toLocaleString('vi-VN')}đ`
            )
            .join('\n')
        : 'Không có giao dịch nào trong bộ lọc hiện tại.'

    const systemPrompt = `Bạn là trợ lý tài chính cá nhân. Phân tích giao dịch và đưa ra lời khuyên ngân sách bằng tiếng Việt. Ngắn gọn, thực tế.\n\nDữ liệu giao dịch:\n${contextText}`

    try {
      const response = await fetch(apiConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`API trả về lỗi: ${response.status} ${response.statusText}`)
      }

      const json = await response.json()

      // OpenAI-compatible response format: json.choices[0].message.content
      const assistantText =
        (json as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content ?? 'Không có phản hồi từ API.'

      addMessage({ role: 'assistant', content: assistantText })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Đã có lỗi khi kết nối tới API.'
      addMessage({ role: 'error', content: `Lỗi: ${message}` })
    } finally {
      setLoading(false)
    }
  }

  return { sendMessage, isLoading, isConfigured: Boolean(apiConfig?.endpoint && apiConfig?.apiKey) }
}
