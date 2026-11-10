/**
 * Khung dùng chung cho Dialog và AlertDialog.
 *
 * - < sm: bottom sheet neo đáy (dùng một tay, không bị bàn phím ảo đẩy mất tiêu đề).
 * - >= sm: hộp giữa màn như shadcn gốc.
 * - Luôn giới hạn chiều cao theo viewport và tự cuộn: form dài (thêm thẻ ~860px) từng tràn khỏi
 *   màn 667px, mất cả tiêu đề lẫn nút Lưu mà không cuộn được.
 */
export const DIALOG_SURFACE_CLASSES = [
  'fixed z-50 grid w-full gap-4 overflow-y-auto overscroll-contain border bg-background p-6 shadow-xl outline-none duration-200',
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
  // Điện thoại: sheet đáy, chừa safe-area của thanh home iPhone
  'inset-x-0 bottom-0 max-h-[calc(100dvh-1rem)] rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]',
  'max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom',
  // Màn rộng: giữa màn
  'sm:inset-x-auto sm:bottom-auto sm:top-[50%] sm:left-[50%] sm:max-h-[calc(100dvh-2rem)] sm:translate-x-[-50%] sm:translate-y-[-50%]',
  'sm:rounded-lg sm:pb-6 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
  // Có footer dính thì footer tự đệm đáy: không để nội dung lọt qua khe dưới footer khi cuộn
  'has-[[data-slot$=footer]]:pb-0 sm:has-[[data-slot$=footer]]:pb-0',
].join(' ')

/**
 * Footer dính đáy vùng cuộn: nút hành động chính luôn bấm được dù form dài.
 * `-mx-6 px-6` kéo nền phủ hết bề ngang (khung có p-6).
 */
export const DIALOG_FOOTER_CLASSES =
  'sticky bottom-0 z-10 -mx-6 flex flex-col-reverse gap-2 border-t bg-background px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-6'
