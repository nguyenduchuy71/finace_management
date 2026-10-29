import { describe, it, expect, vi } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'
import { getErrorMessage, toApiError, notFound, requireAffected, countRows } from './api-errors'

const pgError = (code: string) => ({ code, message: 'relation "x" internal', details: 'd', hint: '' }) as PostgrestError

describe('toApiError', () => {
  it('không lộ message gốc của Postgres; override riêng thắng thông điệp chung', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(toApiError(pgError('23505'))).toEqual({ code: '23505', message: 'Dữ liệu đã tồn tại.' })
    expect(toApiError(pgError('23505'), { '23505': 'Thẻ này đã tồn tại.' }).message).toBe('Thẻ này đã tồn tại.')
    expect(toApiError(pgError('XX000')).message).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.')
  })
})

describe('toApiError: thứ tự ưu tiên thông điệp', () => {
  it('override > thông điệp chung > mặc định; override chỉ áp cho đúng mã', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const overrides = { P0002: 'Không tìm thấy rule.' }
    expect(toApiError(pgError('P0002'), overrides)).toEqual({ code: 'P0002', message: 'Không tìm thấy rule.' })
    expect(toApiError(pgError('42501'), overrides).message).toBe('Bạn không có quyền xem dữ liệu này.')
    expect(toApiError(pgError('XX000'), overrides).message).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.')
  })

  it('lỗi không có code -> SUPABASE_ERROR, không lộ message gốc', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const e = toApiError({ message: 'secret column', details: '', hint: '' } as PostgrestError)
    expect(e).toEqual({ code: 'SUPABASE_ERROR', message: 'Đã có lỗi xảy ra. Vui lòng thử lại.' })
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

describe('notFound / requireAffected', () => {
  it('0 dòng hoặc null -> ném NOT_FOUND với thông điệp của nơi gọi; có dòng thì im lặng', () => {
    expect(notFound('x')).toEqual({ code: 'NOT_FOUND', message: 'x' })
    expect(() => requireAffected([], 'Không thấy A')).toThrow()
    try { requireAffected(null, 'Không thấy A') } catch (e) { expect(e).toEqual({ code: 'NOT_FOUND', message: 'Không thấy A' }) }
    expect(() => requireAffected([{ id: '1' }], 'Không thấy A')).not.toThrow()
  })
})

describe('countRows', () => {
  it('trả count; null -> 0', async () => {
    expect(await countRows(Promise.resolve({ count: 5, error: null }))).toBe(5)
    expect(await countRows(Promise.resolve({ count: null, error: null }))).toBe(0)
  })

  it('lỗi -> ApiError qua toApiError (có override)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(countRows(Promise.resolve({ count: null, error: pgError('42501') }))).rejects.toEqual({
      code: '42501', message: 'Bạn không có quyền xem dữ liệu này.',
    })
    await expect(countRows(Promise.resolve({ count: null, error: pgError('42501') }), { '42501': 'riêng' })).rejects.toMatchObject({ message: 'riêng' })
  })
})
