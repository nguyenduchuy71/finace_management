/** bigint/numeric của Postgres có thể về dạng string; VND < 2^53 nên Number() an toàn. */
export const toInt = (v: number | string): number => Math.round(Number(v))

/**
 * Chuẩn hoá timestamptz của Postgres về ISO-8601 dạng `Z`.
 *
 * PostgREST trả "2026-08-05T03:00:00+00:00" nhưng Zod `.datetime()` chỉ chấp nhận
 * hậu tố `Z`, nên parse thẳng sẽ fail "Invalid ISO datetime".
 * Frontend đã coi mọi timestamp là UTC rồi đổi sang giờ VN khi hiển thị
 * (utils/dates.ts), nên toISOString() giữ nguyên đúng thời điểm.
 */
export const toISO = (v: string): string => new Date(v).toISOString()

/** Như toISO nhưng cột nullable: null / chuỗi rỗng -> null. */
export const toISOOrNull = (v: string | null | undefined): string | null => (v ? toISO(v) : null)
