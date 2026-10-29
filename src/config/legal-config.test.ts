import { describe, it, expect } from 'vitest'
import { assertLegalEnv, missingLegalEnv } from './legal-env-guard'
import { LEGAL_PLACEHOLDER, resolveLegalConfig } from './legal-config'

const FULL = {
  VITE_LEGAL_OPERATOR_NAME: 'Công ty ABC',
  VITE_LEGAL_CONTACT_EMAIL: 'lienhe@abc.vn',
  VITE_DATA_REGION: 'Singapore (ap-southeast-1)',
}

describe('missingLegalEnv', () => {
  it('đủ ba biến -> không thiếu', () => expect(missingLegalEnv(FULL)).toEqual([]))
  it('thiếu, rỗng hoặc chỉ khoảng trắng -> liệt kê đúng biến', () => {
    expect(missingLegalEnv({ ...FULL, VITE_LEGAL_OPERATOR_NAME: '', VITE_DATA_REGION: '  ' }))
      .toEqual(['VITE_LEGAL_OPERATOR_NAME', 'VITE_DATA_REGION'])
    expect(missingLegalEnv({})).toHaveLength(3)
  })
})

describe('assertLegalEnv', () => {
  it('production + thiếu biến -> throw, nêu tên biến thiếu', () => {
    expect(() => assertLegalEnv('production', { ...FULL, VITE_LEGAL_CONTACT_EMAIL: '' }))
      .toThrow(/thiếu biến pháp lý: VITE_LEGAL_CONTACT_EMAIL/)
  })
  it('production + đủ biến -> qua', () => expect(() => assertLegalEnv('production', FULL)).not.toThrow())
  it.each([undefined, 'preview', 'development'])('VERCEL_ENV=%s + thiếu biến -> vẫn qua (CI, local, preview)', (v) => {
    expect(() => assertLegalEnv(v, {})).not.toThrow()
  })
})

describe('resolveLegalConfig', () => {
  it('có giá trị thì dùng (cắt khoảng trắng), thiếu thì marker', () => {
    expect(resolveLegalConfig({ ...FULL, VITE_LEGAL_OPERATOR_NAME: ' Công ty ABC ' }).operatorName).toBe('Công ty ABC')
    expect(resolveLegalConfig({})).toEqual({
      operatorName: LEGAL_PLACEHOLDER, contactEmail: LEGAL_PLACEHOLDER, dataRegion: LEGAL_PLACEHOLDER,
    })
  })
})
