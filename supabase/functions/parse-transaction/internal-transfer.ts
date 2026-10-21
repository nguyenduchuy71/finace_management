// Nhận diện giao dịch chuyển tiền giữa TK/thẻ của CHÍNH user (transactions.kind
// = 'internal_transfer'), để dashboard không đếm cả hai chiều vào thu/chi.
//
// CHỈ gắn khi tín hiệu rõ ràng. Nội dung chuyển khoản mặc định ở VN là
// "<TÊN NGƯỜI GỬI> chuyen tien", nên khoản CHI có tên chủ TK trong nội dung vẫn
// có thể là chuyển cho người khác — gắn nhầm thì một khoản chi thật biến mất khỏi
// dashboard (tệ hơn đếm thừa). Vì vậy:
//   - "THANH TOAN THE TIN DUNG" (trả nợ thẻ)                    -> nội bộ, mọi chiều
//   - tiền VÀO, nội dung có tên chủ TK + chuyen tien/khoan       -> nội bộ (người gửi là mình)
//   - tiền RA, người NHẬN là chủ TK: "<số TK>_<TÊN>" / "<số TK>-<TÊN>" -> nội bộ
//   - còn lại -> 'normal' (user sửa tay nếu sai)

import type { ParsedTransaction } from './types.ts'

/** Bỏ dấu tiếng Việt + upper-case + gộp khoảng trắng — so khớp không phụ thuộc cách viết. */
export function normalizeVN(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** OWNER_NAMES="NGUYEN DUC HUY;Nguyễn Đức Huy" -> ['NGUYEN DUC HUY'] (đã chuẩn hoá, bỏ trùng). */
export function parseOwnerNames(raw: string | undefined | null): string[] {
  if (!raw) return []
  return [...new Set(raw.split(';').map(normalizeVN).filter((n) => n.length >= 3))]
}

/** Chốt `kind` cho giao dịch vừa parse: giữ kind parser đã set, không thì suy từ nội dung. */
export function withKind(p: ParsedTransaction, ownerNames: string[]): ParsedTransaction {
  if (p.kind) return p
  const internal = detectInternalTransfer(p.description, p.amount, ownerNames)
  return { ...p, kind: internal ? 'internal_transfer' : 'normal' }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function detectInternalTransfer(
  description: string,
  amount: number,
  ownerNames: string[],
): boolean {
  const d = normalizeVN(description)
  // Phí dịch vụ có thể chứa cụm này ("PHI ... THANH TOAN THE TIN DUNG") — phí là chi thật.
  if (d.includes('THANH TOAN THE TIN DUNG') && !/\bPHI\b/.test(d)) return true

  return ownerNames.some((owner) => {
    const name = escapeRe(owner)
    if (amount > 0) {
      return new RegExp(`\\b${name}\\b[^A-Z]{0,3}(CHUYEN (TIEN|KHOAN)|CK\\b)`).test(d)
    }
    return new RegExp(`\\d{6,}[_-]${name}\\b`).test(d)
  })
}
