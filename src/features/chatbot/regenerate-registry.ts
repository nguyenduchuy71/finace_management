// Hàm "Tạo lại" do useChatApi đăng ký, ChatMessage gọi. Để NGOÀI Zustand: hàm không phải state
// (không persist được, đổi identity theo mỗi render của hook) và lưu trong store từng kéo theo
// vòng lặp render vô hạn. Chỉ có một ChatInput (một hook) tồn tại tại một thời điểm.
let handler: (() => void) | null = null

/** Đăng ký handler; trả hàm huỷ — chỉ gỡ nếu handler vẫn là của lần đăng ký này. */
export function registerRegenerate(fn: () => void): () => void {
  handler = fn
  return () => {
    if (handler === fn) handler = null
  }
}

/** Gọi handler hiện tại; chưa đăng ký (chat chưa mount) thì không làm gì. */
export function triggerRegenerate(): void {
  handler?.()
}
