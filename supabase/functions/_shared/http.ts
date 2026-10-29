// Phần HTTP dùng chung cho các edge function (parse-transaction, admin, delete-account).
// Import tương đối (`../_shared/http.ts`) — Supabase CLI đóng gói cùng function khi deploy.

/** '*' an toàn: các function xác thực bằng Bearer (không cookie) nên trang lạ không mượn được phiên. */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** JSON response; `extraHeaders` (vd CORS_HEADERS) đứng trước Content-Type. */
export function jsonResponse(
  body: unknown, status: number, extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...extraHeaders, 'Content-Type': 'application/json' },
  })
}

/** Token của "Authorization: Bearer <token>" (đúng một token, không phân biệt hoa thường), không thì null. */
export function bearerToken(headers: Headers): string | null {
  return /^Bearer\s+(\S+)$/i.exec(headers.get('authorization') ?? '')?.[1] ?? null
}

export type ReadBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 413 | 400; error: 'body too large' | 'invalid json' }

/**
 * Đọc body thô, chặn độ dài TRƯỚC `JSON.parse` rồi mới parse. Không đóng gói response:
 * mỗi function giữ nguyên hình dạng lỗi của mình (parse-transaction thêm `max`).
 */
export async function readJsonBody(req: Request, maxLength: number): Promise<ReadBodyResult> {
  const raw = await req.text()
  if (raw.length > maxLength) return { ok: false, status: 413, error: 'body too large' }
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false, status: 400, error: 'invalid json' }
  }
}
