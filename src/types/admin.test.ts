import { describe, it, expect } from 'vitest'
import { formatParseRate, suspensionState } from './admin'

const NOW = '2026-10-27T12:00:00Z'

describe('suspensionState', () => {
  it('cờ DB và ban GoTrue cùng bật (ban còn hạn) -> suspended', () => {
    expect(suspensionState({ suspendedAt: '2026-10-27T11:00:00Z', bannedUntil: '2126-01-01T00:00:00Z' }, NOW)).toBe('suspended')
  })

  it('không có cờ và không ban -> active', () => {
    expect(suspensionState({ suspendedAt: null, bannedUntil: null }, NOW)).toBe('active')
  })

  it('cờ DB bật nhưng GoTrue chưa ban (ban lỗi giữa chừng) -> mismatch', () => {
    expect(suspensionState({ suspendedAt: '2026-10-27T11:00:00Z', bannedUntil: null }, NOW)).toBe('mismatch')
  })

  it('GoTrue ban nhưng cờ DB trống -> mismatch', () => {
    expect(suspensionState({ suspendedAt: null, bannedUntil: '2126-01-01T00:00:00Z' }, NOW)).toBe('mismatch')
  })

  it('ban đã hết hạn (bannedUntil quá khứ) kèm cờ -> mismatch, không phải suspended', () => {
    expect(suspensionState({ suspendedAt: '2026-10-01T00:00:00Z', bannedUntil: '2026-10-02T00:00:00Z' }, NOW)).toBe('mismatch')
  })

  it('so sánh THỜI ĐIỂM, không so chuỗi: +07:00 cùng lúc với 10:00Z vẫn là quá khứ so với 12:00Z', () => {
    // 17:00+07:00 = 10:00Z < 12:00Z -> đã hết hạn. So chuỗi sẽ coi là còn hạn ('7' > '2').
    const bannedUntil = '2026-10-27T17:00:00+07:00'
    expect(suspensionState({ suspendedAt: null, bannedUntil }, NOW)).toBe('active')
    expect(suspensionState({ suspendedAt: '2026-10-01T00:00:00Z', bannedUntil }, NOW)).toBe('mismatch')
  })

  it('offset +00:00 (Postgres) và Z (GoTrue) cùng thời điểm đều được coi là còn hạn', () => {
    expect(suspensionState({ suspendedAt: 'x', bannedUntil: '2026-10-28T00:00:00+00:00' }, NOW)).toBe('suspended')
  })
})

describe('formatParseRate', () => {
  it('null (chưa có tin trong 30 ngày) -> gạch ngang', () => {
    expect(formatParseRate(null)).toBe('—')
  })

  it('làm tròn tới phần trăm nguyên', () => {
    expect(formatParseRate(0.876)).toBe('88%')
    expect(formatParseRate(0.5)).toBe('50%')
  })

  it('biên 0 và 1', () => {
    expect(formatParseRate(0)).toBe('0%')
    expect(formatParseRate(1)).toBe('100%')
  })
})
