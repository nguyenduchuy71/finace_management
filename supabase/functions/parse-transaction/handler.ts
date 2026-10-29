// Pipeline của parse-transaction: xác thực -> body/giới hạn -> OTP? -> trùng? -> regex parser -> ghi.
// Phụ thuộc (xác thực, DB) được tiêm vào để test không cần mạng.

import { jsonResponse as json, readJsonBody } from '../_shared/http.ts'
import { resolveCaller, type AuthenticateRpc, type LegacyConfig } from './api-key-auth.ts'
import { isOtp, parseNotification } from './ingest.ts'
import { MAX_BODY_LENGTH, parseIngestBody } from './request.ts'
import type { IngestStore } from './persist.ts'

export type HandlerDeps = {
  authenticate: AuthenticateRpc
  legacy: LegacyConfig
  store: IngestStore
}

export function createHandler({ authenticate, legacy, store }: HandlerDeps) {
  return async (req: Request): Promise<Response> => {
    try {
      const auth = await resolveCaller(req.headers, authenticate, legacy)
      if (!auth.ok) return json({ error: auth.error }, auth.status)
      const { userId, ownerNames } = auth.caller

      const read = await readJsonBody(req, MAX_BODY_LENGTH)
      if (!read.ok) {
        return json(read.status === 413 ? { error: read.error, max: MAX_BODY_LENGTH } : { error: read.error }, read.status)
      }
      // Chặn payload dài TRƯỚC khi chạy parser (MAX_TEXT_LENGTH trong request.ts).
      //
      // Regex parser chạy đồng bộ, không nhường CPU; parser SHB từng có lazy scan không neo O(N²)
      // (203KB = 8.665ms, đã neo lại trong parsers-card-sms.ts). Cap này là lớp chặn thứ hai cho
      // parser mới lỡ có backtracking. Thông báo ngân hàng thật < 500 ký tự.
      const parsedBody = parseIngestBody(read.value)
      if (!parsedBody.ok) return json(parsedBody.body, parsedBody.status)
      const { text, source } = parsedBody

      // OTP / bảo mật: không phải giao dịch và KHÔNG lưu (mã còn hiệu lực).
      if (isOtp(text)) return json({ skipped: 'otp_or_security' }, 200)

      if (await store.isDuplicate(text, userId)) return json({ skipped: 'duplicate' }, 200)

      const outcome = parseNotification(text, ownerNames)
      if (outcome.status === 'parsed') {
        const parsed = outcome.tx
        const result = await store.insertTx(parsed, userId, source)
        if (result.kind === 'no_account') {
          return json({ skipped: 'no_account', bank: parsed.bank_name, account_ref: parsed.account_ref }, 200)
        }
        // KHÔNG vọng `raw_text` về response: nó chứa nguyên văn thông báo
        // (số TK, số dư, tên người chuyển). Chỉ trả field cần cho Shortcut debug.
        const inserted = { ...parsed, ...result.refs } as Record<string, unknown>
        delete inserted.raw_text
        return json({ inserted }, 201)
      }
      // Regex khớp nhưng ra dữ liệu vô nghĩa -> không ghi rác vào DB, trả 422
      // thay vì để Postgres báo 500.
      if (outcome.status === 'invalid') {
        await store.saveUnparsed(text, source, 'invalid_parse', userId)
        return json({ skipped: 'invalid_parse', bank: outcome.bank }, 422)
      }

      // Không khớp bank nào -> lưu lại để bổ sung parser sau.
      // Đây là NGUỒN DỮ LIỆU để viết parser cho bank còn thiếu: query bảng này
      // lấy raw_text thật rồi thêm test case vào parsers.test.ts.
      await store.saveUnparsed(text, source, 'no_match', userId)
      return json({ skipped: 'no_match' }, 200)
    } catch (e) {
      // Chi tiết chỉ vào log: thông điệp lỗi Postgres/supabase-js lộ tên bảng, cột, ràng buộc.
      console.error('parse-transaction failed', String(e))
      return json({ error: 'internal_error' }, 500)
    }
  }
}
