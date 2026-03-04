import { useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useChatStore } from '@/stores/chatStore'
import { useFilterStore } from '@/stores/filterStore'
import { useTransactions } from '@/hooks/useTransactions'

const SYSTEM_PROMPT_BASE = `Bạn là trợ lý tài chính cá nhân cho người dùng Việt Nam. \
Phân tích dữ liệu giao dịch và đưa ra lời khuyên thực tế, ngắn gọn bằng tiếng Việt. \
Sử dụng markdown để định dạng câu trả lời (danh sách, in đậm cho số tiền quan trọng). \
Luôn trả lời bằng tiếng Việt trừ khi người dùng hỏi bằng ngôn ngữ khác.`

// Lazy-load the Anthropic SDK — ~72KB chunk deferred until first chat message is sent.
// The SDK chunk ('anthropic') is loaded from Vite's manualChunks on first invocation.
async function loadAnthropicSDK() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  return Anthropic
}

export function useChatApi() {
  const {
    apiConfig,
    messages,
    addMessage,
    setLoading,
    isLoading,
    setRegenerateCallback,
  } = useChatStore()

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

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isLoading) return

      // Guard: API not configured
      if (!apiConfig?.apiKey || !apiConfig?.model) {
        addMessage({
          role: 'error',
          content:
            'Chưa cấu hình API. Nhấn biểu tượng ⚙️ để nhập Anthropic API key và chọn model.',
        })
        return
      }

      // Add user message to store
      addMessage({ role: 'user', content: userText })
      setLoading(true)

      // Build transaction context (cap at 20 to prevent token overflow)
      const contextSample = visibleTransactions.slice(0, 20)
      const filterDesc = [
        accountId ? `tài khoản ${accountId}` : null,
        dateFrom ? `từ ${dateFrom}` : null,
        dateTo ? `đến ${dateTo}` : null,
        txType !== 'all' ? `loại ${txType}` : null,
        searchQuery ? `tìm kiếm "${searchQuery}"` : null,
      ]
        .filter(Boolean)
        .join(', ')

      const contextText =
        contextSample.length > 0
          ? `Dữ liệu ${contextSample.length} giao dịch${filterDesc ? ` (lọc: ${filterDesc})` : ''}:\n` +
            contextSample
              .map(
                (tx) =>
                  `- ${tx.transactionDate.slice(0, 10)}: ${tx.merchantName ?? tx.description} | ${tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toLocaleString('vi-VN')}đ`
              )
              .join('\n')
          : 'Không có giao dịch nào trong bộ lọc hiện tại.'

      const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${contextText}`

      // Build conversation history from store messages (exclude error messages)
      // Anthropic API accepts: { role: 'user' | 'assistant', content: string }[]
      const conversationHistory = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

      // Append the new user message to history
      conversationHistory.push({ role: 'user', content: userText })

      try {
        // Lazy-load Anthropic SDK on first message — avoids loading ~72KB on initial page render
        const Anthropic = await loadAnthropicSDK()
        const client = new Anthropic({
          apiKey: apiConfig.apiKey,
          dangerouslyAllowBrowser: true,
        })

        const stream = await client.messages.stream({
          model: apiConfig.model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: conversationHistory,
        })

        // Collect full streamed response then add as single message
        // (ChatPanel typing indicator is shown during isLoading=true)
        const finalMessage = await stream.finalMessage()
        const assistantText =
          finalMessage.content.find((b) => b.type === 'text')?.text ??
          'Không có phản hồi từ API.'

        addMessage({ role: 'assistant', content: assistantText })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Đã có lỗi khi kết nối tới Anthropic API.'
        addMessage({ role: 'error', content: `Lỗi: ${message}` })
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiConfig, messages, visibleTransactions, searchQuery, dateFrom, dateTo, txType, accountId, isLoading]
  )

  // Register regenerate callback: re-send the last user message
  useEffect(() => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMessage) {
      setRegenerateCallback(() => () => sendMessage(lastUserMessage.content))
    } else {
      setRegenerateCallback(null)
    }
    return () => setRegenerateCallback(null)
  }, [messages, sendMessage, setRegenerateCallback])

  return {
    sendMessage,
    isLoading,
    isConfigured: Boolean(apiConfig?.apiKey && apiConfig?.model),
  }
}
