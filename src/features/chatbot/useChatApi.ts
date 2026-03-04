import { useShallow } from 'zustand/react/shallow'
import { useChatStore } from '@/stores/chatStore'
import { useFilterStore } from '@/stores/filterStore'
import { useTransactions } from '@/hooks/useTransactions'

// NOTE: This hook will be replaced in 05-03 with Anthropic SDK integration.
// For now it uses a placeholder that shows a "not configured" error until
// the SDK integration is complete. The apiConfig shape is { apiKey, model }.
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

    if (!apiConfig?.apiKey) {
      addMessage({
        role: 'error',
        content:
          'Chưa cấu hình API. Nhấn biểu tượng cài đặt để nhập API key và chọn model.',
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

    const _contextText = contextText // Will be used in 05-03 SDK integration

    try {
      // Placeholder: 05-03 will replace this with Anthropic SDK call using apiConfig.apiKey and apiConfig.model
      addMessage({
        role: 'error',
        content: `SDK integration chưa hoàn thành. Vui lòng chờ 05-03. Model được chọn: ${apiConfig.model}`,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Đã có lỗi khi kết nối tới API.'
      addMessage({ role: 'error', content: `Lỗi: ${message}` })
    } finally {
      setLoading(false)
    }
  }

  return { sendMessage, isLoading, isConfigured: Boolean(apiConfig?.apiKey) }
}
