import { describe, it, expect, vi } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'
import { getErrorMessage, toApiError } from './api-errors'

const pgError = (code: string) => ({ code, message: 'relation "x" internal', details: 'd', hint: '' }) as PostgrestError

describe('toApiError', () => {
  it('không lộ message gốc của Postgres; override riêng thắng thông điệp chung', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(toApiError(pgError('23505'))).toEqual({ code: '23505', message: 'Dữ liệu đã tồn tại.' })
    expect(toApiError(pgError('23505'), { '23505': 'Thẻ này đã tồn tại.' }).message).toBe('Thẻ này đã tồn tại.')
    expect(toApiError(pgError('XX000')).message).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.')
  })
})

describe('getErrorMessage', () => {
  it('lấy message của ApiError hoặc Error', () => {
    expect(getErrorMessage({ code: '42501', message: 'Bạn không có quyền.' }, 'fallback')).toBe('Bạn không có quyền.')
    expect(getErrorMessage(new Error('Failed to fetch'), 'fallback')).toBe('Failed to fetch')
  })

  it('không có message dùng được -> fallback', () => {
    for (const err of [undefined, null, 'chuỗi', {}, { message: '' }, { message: 42 }]) {
      expect(getErrorMessage(err, 'fallback')).toBe('fallback')
    }
  })
})
