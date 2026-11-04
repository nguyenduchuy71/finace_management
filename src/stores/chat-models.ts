/** Model Claude chatbot cho chọn. User dùng API key của chính mình nên mặc định là cỡ vừa. */
export const CHAT_MODELS = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (Mạnh nhất)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (Khuyên dùng)' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (Nhanh, tiết kiệm)' },
] as const

export const DEFAULT_CHAT_MODEL = 'claude-sonnet-5-5'

/** Model đã lưu không còn trong danh sách (vd Claude 3 đã ngừng) -> về mặc định, giữ nguyên API key. */
export function normalizeChatModel(model: unknown): string {
  return CHAT_MODELS.some((m) => m.value === model) ? (model as string) : DEFAULT_CHAT_MODEL
}
