import { useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useChatStore } from '@/stores/chatStore'
import { useFilterStore } from '@/stores/filterStore'
import { useTransactions } from '@/hooks/useTransactions'
import { buildSystemPrompt, regenerateTurns, toChatTurns, type ChatTurn } from './chat-context'

/** Giới hạn độ dài câu trả lời của model. */
const MAX_REPLY_TOKENS = 1024

// Lazy-load the Anthropic SDK — ~72KB chunk deferred until first chat message is sent.
// The SDK chunk ('anthropic') is loaded from Vite's manualChunks on first invocation.
async function loadAnthropicSDK() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  return Anthropic
}

export function useChatApi() {
  // useShallow + danh sách field cụ thể: gọi useChatStore() trần sẽ subscribe
  // TOÀN BỘ store, nên mỗi lần setRegenerateCallback ghi vào store là hook này
  // re-render -> góp phần tạo vòng lặp vô hạn (xem comment ở visibleTransactions).
  const {
    apiConfig,
    messages,
    addMessage,
    setLoading,
    isLoading,
    setRegenerateCallback,
  } = useChatStore(
    useShallow((s) => ({
      apiConfig: s.apiConfig,
      messages: s.messages,
      addMessage: s.addMessage,
      setLoading: s.setLoading,
      isLoading: s.isLoading,
      setRegenerateCallback: s.setRegenerateCallback,
    }))
  )

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
  // useMemo BẮT BUỘC: flatMap trong thân render trả array mới mỗi lần render ->
  // sendMessage (useCallback nhận nó làm dep) đổi identity mỗi render ->
  // useEffect đăng ký regenerate chạy lại -> setRegenerateCallback ghi store ->
  // re-render -> lặp vô hạn ("Maximum update depth exceeded"), vỡ ngay khi mở
  // chat panel. Đã tái hiện bằng renderHook trước khi sửa.
  const visibleTransactions = useMemo(
    () => transactionPages?.pages.flatMap((p) => p.data) ?? [],
    [transactionPages]
  )

  /** Gọi API với lịch sử ĐÃ có sẵn tin user cuối, rồi thêm câu trả lời (hoặc lỗi) vào store. */
  const requestReply = useCallback(
    async (history: ChatTurn[]) => {
      if (!apiConfig?.apiKey || !apiConfig?.model) return
      setLoading(true)
      const systemPrompt = buildSystemPrompt(visibleTransactions, { accountId, dateFrom, dateTo, txType, searchQuery })

      try {
        // Lazy-load Anthropic SDK on first message — avoids loading ~72KB on initial page render
        const Anthropic = await loadAnthropicSDK()
        const client = new Anthropic({
          apiKey: apiConfig.apiKey,
          dangerouslyAllowBrowser: true,
        })

        const stream = await client.messages.stream({
          model: apiConfig.model,
          max_tokens: MAX_REPLY_TOKENS,
          system: systemPrompt,
          messages: history,
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
    [apiConfig, visibleTransactions, searchQuery, dateFrom, dateTo, txType, accountId, addMessage, setLoading]
  )

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

      addMessage({ role: 'user', content: userText })
      await requestReply([...toChatTurns(messages), { role: 'user', content: userText }])
    },
    [apiConfig, messages, isLoading, addMessage, requestReply]
  )

  // "Tạo lại": ChatMessage xoá câu trả lời rồi gọi hàm này. Đọc store LÚC GỌI (đã xoá xong) thay vì
  // `messages` của lần render trước — bản cũ gửi lại cả câu trả lời vừa xoá và thêm trùng câu hỏi.
  // Truyền THẲNG hàm: setter của zustand không phải setState của React, `() => () => …` từng lưu hàm
  // bọc ngoài nên bấm "Tạo lại" chỉ xoá câu trả lời mà không gửi gì.
  useEffect(() => {
    setRegenerateCallback(() => {
      const history = regenerateTurns(useChatStore.getState().messages)
      if (history && !useChatStore.getState().isLoading) void requestReply(history)
    })
  }, [requestReply, setRegenerateCallback])

  return { sendMessage, isLoading }
}
