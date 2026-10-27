import { describe, it, expect, vi, beforeEach } from 'vitest'

const auth = vi.hoisted(() => ({
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(),
    listFactors: vi.fn(),
    unenroll: vi.fn(),
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
  },
}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }))

import { isAdminSession, getMfaStatus, startTotpEnrollment, verifyTotp } from './mfa'
import { sessionWithRole } from '@/test/fixtures/admin'

type Factor = { id: string; factor_type: string; status: 'verified' | 'unverified' }
const factors = (all: Factor[]) => ({
  data: { all, totp: all.filter((f) => f.factor_type === 'totp' && f.status === 'verified') },
  error: null,
})
const aal = (currentLevel: 'aal1' | 'aal2') => ({ data: { currentLevel, nextLevel: 'aal2' }, error: null })

beforeEach(() => {
  vi.clearAllMocks()
  auth.mfa.unenroll.mockResolvedValue({ data: {}, error: null })
})

describe('isAdminSession', () => {
  it('chỉ app_metadata.role === admin mới là admin', () => {
    expect(isAdminSession(sessionWithRole('admin'))).toBe(true)
    expect(isAdminSession(sessionWithRole('user'))).toBe(false)
    expect(isAdminSession(sessionWithRole(undefined))).toBe(false)
  })

  it('không có session -> false', () => {
    expect(isAdminSession(null)).toBe(false)
  })

  it('role viết hoa khác chuỗi -> false (không tự nới)', () => {
    expect(isAdminSession(sessionWithRole('Admin'))).toBe(false)
  })
})

describe('getMfaStatus', () => {
  it('aal2 -> verified, không cần gọi listFactors', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('aal2'))
    expect(await getMfaStatus()).toEqual({ step: 'verified' })
    expect(auth.mfa.listFactors).not.toHaveBeenCalled()
  })

  it('aal1 và có TOTP đã verify -> challenge kèm factorId', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('aal1'))
    auth.mfa.listFactors.mockResolvedValue(factors([{ id: 'f1', factor_type: 'totp', status: 'verified' }]))
    expect(await getMfaStatus()).toEqual({ step: 'challenge', factorId: 'f1' })
  })

  it('aal1, chưa có factor -> enroll', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('aal1'))
    auth.mfa.listFactors.mockResolvedValue(factors([]))
    expect(await getMfaStatus()).toEqual({ step: 'enroll' })
  })

  it('chỉ có factor CHƯA verify (enroll dở) -> enroll, KHÔNG challenge được factor đó', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('aal1'))
    auth.mfa.listFactors.mockResolvedValue(factors([{ id: 'f-dở', factor_type: 'totp', status: 'unverified' }]))
    expect(await getMfaStatus()).toEqual({ step: 'enroll' })
  })

  it('lỗi getAuthenticatorAssuranceLevel -> ném lỗi (gate hiện thông báo lỗi)', async () => {
    const boom = new Error('aal down')
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: boom })
    await expect(getMfaStatus()).rejects.toBe(boom)
  })

  it('lỗi listFactors -> ném lỗi', async () => {
    const boom = new Error('factors down')
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('aal1'))
    auth.mfa.listFactors.mockResolvedValue({ data: null, error: boom })
    await expect(getMfaStatus()).rejects.toBe(boom)
  })
})

describe('startTotpEnrollment', () => {
  it('xoá factor TOTP chưa verify còn sót TRƯỚC khi enroll mới', async () => {
    auth.mfa.listFactors.mockResolvedValue(factors([{ id: 'stale', factor_type: 'totp', status: 'unverified' }]))
    auth.mfa.enroll.mockResolvedValue({ data: { id: 'new', totp: { qr_code: 'data:x', secret: 'S' } }, error: null })
    await startTotpEnrollment()
    expect(auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'stale' })
    const unenrollOrder = auth.mfa.unenroll.mock.invocationCallOrder[0]
    const enrollOrder = auth.mfa.enroll.mock.invocationCallOrder[0]
    expect(unenrollOrder).toBeLessThan(enrollOrder)
  })

  it('KHÔNG xoá factor đã verify, cũng không xoá factor không phải totp', async () => {
    auth.mfa.listFactors.mockResolvedValue(factors([
      { id: 'verified-totp', factor_type: 'totp', status: 'verified' },
      { id: 'other', factor_type: 'phone', status: 'unverified' },
    ]))
    auth.mfa.enroll.mockResolvedValue({ data: { id: 'new', totp: { qr_code: 'q', secret: 's' } }, error: null })
    await startTotpEnrollment()
    expect(auth.mfa.unenroll).not.toHaveBeenCalled()
  })

  it('gọi enroll TOTP với tên "Quản trị" và trả factorId, QR, secret', async () => {
    auth.mfa.listFactors.mockResolvedValue(factors([]))
    auth.mfa.enroll.mockResolvedValue({ data: { id: 'f9', totp: { qr_code: 'data:image/svg', secret: 'ABC' } }, error: null })
    const r = await startTotpEnrollment()
    expect(auth.mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Quản trị' })
    expect(r).toEqual({ factorId: 'f9', qrCode: 'data:image/svg', secret: 'ABC' })
  })

  it('unenroll lỗi -> dừng, KHÔNG enroll', async () => {
    auth.mfa.listFactors.mockResolvedValue(factors([{ id: 'stale', factor_type: 'totp', status: 'unverified' }]))
    const boom = new Error('cannot unenroll')
    auth.mfa.unenroll.mockResolvedValue({ data: null, error: boom })
    await expect(startTotpEnrollment()).rejects.toBe(boom)
    expect(auth.mfa.enroll).not.toHaveBeenCalled()
  })

  it('enroll lỗi -> ném lỗi', async () => {
    auth.mfa.listFactors.mockResolvedValue(factors([]))
    const boom = new Error('enroll refused')
    auth.mfa.enroll.mockResolvedValue({ data: null, error: boom })
    await expect(startTotpEnrollment()).rejects.toBe(boom)
  })
})

describe('verifyTotp', () => {
  it('challengeAndVerify đúng factorId và mã', async () => {
    auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    await verifyTotp('f1', '123456')
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
  })

  it('sai mã -> ném lỗi để form hiện thông điệp', async () => {
    const boom = new Error('invalid code')
    auth.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: boom })
    await expect(verifyTotp('f1', '000000')).rejects.toBe(boom)
  })
})
