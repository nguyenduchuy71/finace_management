import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getUserSettings, updateOwnerNames, normalizeOwnerNames } from './user-settings'

const db = vi.hoisted(() => {
  const state: { data: unknown; error: unknown } = { data: null, error: null }
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'update', 'single']) q[m] = vi.fn(() => q)
  q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: state.data, error: state.error }).then(resolve, reject)
  return { state, q, from: vi.fn(() => q) }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: db.from } }))

beforeEach(() => {
  vi.clearAllMocks()
  db.state.data = null
  db.state.error = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('normalizeOwnerNames (thuần)', () => {
  it.each<[string, string[], string[]]>([
    ['mảng rỗng', [], []],
    ['chỉ khoảng trắng / rỗng -> bỏ hết', ['  ', '\t', ''], []],
    ['trim hai đầu', ['  NGUYEN VAN A  '], ['NGUYEN VAN A']],
    ['gộp khoảng trắng và tab/xuống dòng ở giữa', ['NGUYEN   VAN\tA'], ['NGUYEN VAN A']],
    ['bỏ trùng không phân biệt hoa thường, giữ lần xuất hiện đầu', ['NGUYEN VAN A', 'nguyen van a'], ['NGUYEN VAN A']],
    ['bỏ trùng sau khi gộp khoảng trắng', ['A   B', 'a b', ' A B '], ['A B']],
    ['hoa thường tiếng Việt (Nguyễn/NGUYỄN) coi là trùng', ['Nguyễn Văn A', 'NGUYỄN VĂN A'], ['Nguyễn Văn A']],
    ['chữ đ/Đ (locale vi) coi là trùng', ['đức huy', 'ĐỨC HUY'], ['đức huy']],
    ['giữ nguyên thứ tự', ['TRAN B', 'NGUYEN A', 'LE C'], ['TRAN B', 'NGUYEN A', 'LE C']],
    ['KHÔNG bỏ dấu: "Nguyen" và "Nguyễn" là hai tên khác', ['Nguyen', 'Nguyễn'], ['Nguyen', 'Nguyễn']],
  ])('%s', (_label, input, expected) => {
    expect(normalizeOwnerNames(input)).toEqual(expected)
  })

  it('không đổi mảng đầu vào', () => {
    const input = [' A ', 'a']
    normalizeOwnerNames(input)
    expect(input).toEqual([' A ', 'a'])
  })
})

describe('getUserSettings', () => {
  it('select đúng 3 cột và lấy đúng 1 dòng (.single)', async () => {
    db.state.data = { owner_names: [], privacy_consent_at: null, privacy_policy_version: null }
    await getUserSettings()
    expect(db.from).toHaveBeenCalledWith('user_settings')
    expect(db.q.select).toHaveBeenCalledWith('owner_names, privacy_consent_at, privacy_policy_version')
    expect(db.q.single).toHaveBeenCalled()
  })

  it('map sang camelCase, thời điểm đồng ý về ISO UTC', async () => {
    db.state.data = {
      owner_names: ['NGUYEN VAN A'],
      privacy_consent_at: '2026-10-20T10:00:00+07:00',
      privacy_policy_version: '2026-10',
    }
    await expect(getUserSettings()).resolves.toEqual({
      ownerNames: ['NGUYEN VAN A'],
      privacyConsentAt: '2026-10-20T03:00:00.000Z',
      privacyPolicyVersion: '2026-10',
    })
  })

  it('owner_names NULL -> mảng rỗng; consent NULL -> null', async () => {
    db.state.data = { owner_names: null, privacy_consent_at: null, privacy_policy_version: null }
    await expect(getUserSettings()).resolves.toEqual({
      ownerNames: [], privacyConsentAt: null, privacyPolicyVersion: null,
    })
  })

  it('lỗi DB -> ném ApiError', async () => {
    db.state.error = { code: '42501', message: 'denied', details: '' }
    await expect(getUserSettings()).rejects.toEqual({
      code: '42501',
      message: 'Bạn không có quyền xem dữ liệu này.',
    })
  })
})

describe('updateOwnerNames', () => {
  it('gửi danh sách ĐÃ CHUẨN HOÁ (trim, gộp khoảng trắng, bỏ trùng, bỏ rỗng)', async () => {
    db.state.data = { owner_names: ['NGUYEN VAN A', 'TRAN B'] }
    const saved = await updateOwnerNames(['  NGUYEN   VAN A ', 'nguyen van a', 'TRAN B', '  '])
    expect(db.q.update).toHaveBeenCalledWith({ owner_names: ['NGUYEN VAN A', 'TRAN B'] })
    expect(db.q.select).toHaveBeenCalledWith('owner_names')
    expect(db.q.single).toHaveBeenCalled()
    expect(saved).toEqual(['NGUYEN VAN A', 'TRAN B'])
  })

  it('gửi mảng rỗng khi xoá hết tên', async () => {
    db.state.data = { owner_names: [] }
    await updateOwnerNames(['   '])
    expect(db.q.update).toHaveBeenCalledWith({ owner_names: [] })
  })

  it('vi phạm CHECK 10 tên (23514) -> thông điệp riêng', async () => {
    db.state.error = { code: '23514', message: 'check violated', details: '' }
    await expect(updateOwnerNames(['A'])).rejects.toEqual({
      code: '23514',
      message: 'Tối đa 10 tên chủ tài khoản.',
    })
  })
})
