import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

vi.mock('@/features/auth/mfa', () => ({
  getMfaStatus: vi.fn(),
  startTotpEnrollment: vi.fn(),
  verifyTotp: vi.fn(),
}))

import { getMfaStatus, startTotpEnrollment, verifyTotp } from '@/features/auth/mfa'
import { AuthContext } from '@/features/auth/AuthProvider'
import { MfaGate } from './MfaGate'

const CHILD = 'NỘI DUNG ADMIN'

function renderGate() {
  return render(<MfaGate><p>{CHILD}</p></MfaGate>)
}

const codeInput = () => screen.getByLabelText('Mã xác thực (6 số)')
const submitCode = () => fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MfaGate — aal2', () => {
  it('phiên đã aal2 -> hiện nội dung ngay, không hiện form MFA', async () => {
    vi.mocked(getMfaStatus).mockResolvedValue({ step: 'verified' })
    renderGate()
    expect(await screen.findByText(CHILD)).toBeInTheDocument()
    expect(screen.queryByLabelText('Mã xác thực (6 số)')).toBeNull()
  })

  it('đang kiểm tra -> hiện trạng thái chờ, CHƯA render nội dung', () => {
    vi.mocked(getMfaStatus).mockReturnValue(new Promise(() => {}))
    renderGate()
    expect(screen.getByText(/Đang kiểm tra xác thực hai lớp/)).toBeInTheDocument()
    expect(screen.queryByText(CHILD)).toBeNull()
  })
})

describe('MfaGate — chưa aal2 (không được render children)', () => {
  it('aal1 có factor -> form nhập mã, KHÔNG render children', async () => {
    vi.mocked(getMfaStatus).mockResolvedValue({ step: 'challenge', factorId: 'f1' })
    renderGate()
    expect(await screen.findByLabelText('Mã xác thực (6 số)')).toBeInTheDocument()
    expect(screen.getByText('Xác thực hai lớp')).toBeInTheDocument()
    expect(screen.queryByText(CHILD)).toBeNull()
  })

  it('chưa có factor -> nút "Bắt đầu thiết lập", KHÔNG tự enroll lúc mount', async () => {
    vi.mocked(getMfaStatus).mockResolvedValue({ step: 'enroll' })
    renderGate()
    expect(await screen.findByRole('button', { name: 'Bắt đầu thiết lập' })).toBeInTheDocument()
    expect(screen.getByText('Thiết lập xác thực hai lớp')).toBeInTheDocument()
    expect(screen.queryByText(CHILD)).toBeNull()
    // StrictMode mount 2 lần sẽ tạo 2 factor nếu enroll tự chạy lúc mount.
    expect(startTotpEnrollment).not.toHaveBeenCalled()
  })

  it('lỗi kiểm trạng thái -> thông báo + nút Thử lại gọi kiểm lại', async () => {
    vi.mocked(getMfaStatus).mockRejectedValueOnce(new Error('network'))
    renderGate()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Không kiểm tra được trạng thái xác thực.')
    expect(screen.queryByText(CHILD)).toBeNull()

    vi.mocked(getMfaStatus).mockResolvedValueOnce({ step: 'verified' })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText(CHILD)).toBeInTheDocument()
    expect(getMfaStatus).toHaveBeenCalledTimes(2)
  })
})

describe('MfaGate — nhập mã (challenge)', () => {
  beforeEach(() => {
    vi.mocked(getMfaStatus).mockResolvedValue({ step: 'challenge', factorId: 'f1' })
  })

  it('mã không đủ 6 số -> báo lỗi, KHÔNG gọi verify', async () => {
    renderGate()
    await screen.findByLabelText('Mã xác thực (6 số)')
    for (const bad of ['', '12345', '1234567', 'abcdef']) {
      fireEvent.change(codeInput(), { target: { value: bad } })
      submitCode()
      expect(await screen.findByRole('alert')).toHaveTextContent('Mã gồm 6 chữ số.')
    }
    expect(verifyTotp).not.toHaveBeenCalled()
  })

  it('khoảng trắng trong mã được bỏ trước khi kiểm (vd "123 456" -> "123456")', async () => {
    vi.mocked(verifyTotp).mockResolvedValue(undefined)
    vi.mocked(getMfaStatus).mockResolvedValueOnce({ step: 'challenge', factorId: 'f1' })
    vi.mocked(getMfaStatus).mockResolvedValueOnce({ step: 'verified' })
    renderGate()
    await screen.findByLabelText('Mã xác thực (6 số)')
    fireEvent.change(codeInput(), { target: { value: '123 456' } })
    submitCode()
    await waitFor(() => expect(verifyTotp).toHaveBeenCalledWith('f1', '123456'))
  })

  it('sai mã -> thông điệp, nội dung vẫn bị chặn', async () => {
    vi.mocked(verifyTotp).mockRejectedValue(new Error('invalid'))
    renderGate()
    await screen.findByLabelText('Mã xác thực (6 số)')
    fireEvent.change(codeInput(), { target: { value: '000000' } })
    submitCode()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Mã không đúng hoặc đã hết hạn')
    expect(codeInput()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText(CHILD)).toBeNull()
  })

  it('đúng mã -> kiểm lại trạng thái và hiện nội dung', async () => {
    vi.mocked(verifyTotp).mockResolvedValue(undefined)
    renderGate()
    await screen.findByLabelText('Mã xác thực (6 số)')
    // Đặt SAU khi form hiện: lần kiểm đầu (mount) vẫn phải trả challenge.
    vi.mocked(getMfaStatus).mockResolvedValueOnce({ step: 'verified' })
    fireEvent.change(codeInput(), { target: { value: '654321' } })
    submitCode()
    expect(await screen.findByText(CHILD)).toBeInTheDocument()
    expect(verifyTotp).toHaveBeenCalledWith('f1', '654321')
  })
})

describe('MfaGate — kiểm lại khi phiên đổi', () => {
  const session = (token: string) =>
    ({ access_token: token, user: { id: 'me', app_metadata: { role: 'admin' } } }) as unknown as Session
  const withSession = (s: Session | null) => (
    <AuthContext.Provider value={{ session: s, loading: false }}>
      <MfaGate><p>{CHILD}</p></MfaGate>
    </AuthContext.Provider>
  )

  it('token đổi (vd đăng nhập lại ở tab khác) -> getMfaStatus được gọi lại và chặn nội dung theo trạng thái mới', async () => {
    vi.mocked(getMfaStatus).mockResolvedValueOnce({ step: 'verified' })
    const { rerender } = render(withSession(session('t1')))
    expect(await screen.findByText(CHILD)).toBeInTheDocument()
    expect(getMfaStatus).toHaveBeenCalledTimes(1)

    vi.mocked(getMfaStatus).mockResolvedValueOnce({ step: 'challenge', factorId: 'f1' })
    rerender(withSession(session('t2-aal1')))
    expect(await screen.findByLabelText('Mã xác thực (6 số)')).toBeInTheDocument()
    expect(screen.queryByText(CHILD)).toBeNull()
    expect(getMfaStatus).toHaveBeenCalledTimes(2)
  })

  it('token refresh mà kiểm lại lỗi mạng -> GIỮ nội dung (phiên đã aal2), không chuyển màn lỗi', async () => {
    vi.mocked(getMfaStatus).mockResolvedValueOnce({ step: 'verified' })
    const { rerender } = render(withSession(session('t1')))
    expect(await screen.findByText(CHILD)).toBeInTheDocument()
    vi.mocked(getMfaStatus).mockRejectedValueOnce(new Error('network'))
    rerender(withSession(session('t1-refreshed')))
    await waitFor(() => expect(getMfaStatus).toHaveBeenCalledTimes(2))
    expect(screen.getByText(CHILD)).toBeInTheDocument()
    expect(screen.queryByText(/Không kiểm tra được/)).toBeNull()
  })

  it('lần kiểm ĐẦU lỗi -> màn lỗi (không có phiên aal2 nào để giữ)', async () => {
    vi.mocked(getMfaStatus).mockRejectedValueOnce(new Error('network'))
    render(withSession(session('t1')))
    expect(await screen.findByText(/Không kiểm tra được/)).toBeInTheDocument()
    expect(screen.queryByText(CHILD)).toBeNull()
  })

  it('render lại với cùng token -> KHÔNG gọi lại getMfaStatus', async () => {
    vi.mocked(getMfaStatus).mockResolvedValue({ step: 'verified' })
    const { rerender } = render(withSession(session('same')))
    await screen.findByText(CHILD)
    rerender(withSession(session('same')))
    expect(getMfaStatus).toHaveBeenCalledTimes(1)
  })
})

describe('MfaGate — thiết lập lần đầu (enroll)', () => {
  beforeEach(() => {
    vi.mocked(getMfaStatus).mockResolvedValue({ step: 'enroll' })
  })

  it('bấm bắt đầu -> QR và secret thủ công, rồi form mã với factorId mới', async () => {
    vi.mocked(startTotpEnrollment).mockResolvedValue({
      factorId: 'new-f', qrCode: 'data:image/svg+xml;base64,AAA', secret: 'JBSWY3DPEHPK3PXP',
    })
    renderGate()
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu thiết lập' }))

    expect(await screen.findByAltText('Mã QR thiết lập xác thực hai lớp')).toHaveAttribute('src', 'data:image/svg+xml;base64,AAA')
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
    expect(startTotpEnrollment).toHaveBeenCalledTimes(1)

    vi.mocked(verifyTotp).mockResolvedValue(undefined)
    vi.mocked(getMfaStatus).mockResolvedValueOnce({ step: 'verified' })
    fireEvent.change(codeInput(), { target: { value: '111222' } })
    submitCode()
    await waitFor(() => expect(verifyTotp).toHaveBeenCalledWith('new-f', '111222'))
    expect(await screen.findByText(CHILD)).toBeInTheDocument()
  })

  it('bắt đầu lỗi -> hướng dẫn bật MFA trên Supabase, không có QR', async () => {
    vi.mocked(startTotpEnrollment).mockRejectedValue(new Error('mfa disabled'))
    renderGate()
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu thiết lập' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kiểm tra MFA TOTP đã bật trên Supabase')
    expect(screen.queryByAltText('Mã QR thiết lập xác thực hai lớp')).toBeNull()
  })

  it('nút bắt đầu bị khoá trong lúc chuẩn bị (chống bấm đúp tạo 2 factor)', async () => {
    let resolve!: (v: Awaited<ReturnType<typeof startTotpEnrollment>>) => void
    vi.mocked(startTotpEnrollment).mockReturnValue(new Promise((r) => { resolve = r }))
    renderGate()
    const btn = await screen.findByRole('button', { name: 'Bắt đầu thiết lập' })
    fireEvent.click(btn)
    const busy = await screen.findByRole('button', { name: 'Đang chuẩn bị…' })
    expect(busy).toBeDisabled()
    fireEvent.click(busy)
    expect(startTotpEnrollment).toHaveBeenCalledTimes(1)
    resolve({ factorId: 'f', qrCode: 'q', secret: 's' })
  })
})
