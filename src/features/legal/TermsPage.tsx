import { legalConfig } from '@/config/legal-config'
import { LegalLayout, LegalSection, LegalValue } from './LegalLayout'

/** Điều khoản sử dụng (/terms), gồm chính sách credit và hoàn credit. */
export default function TermsPage() {
  return (
    <LegalLayout title="Điều khoản sử dụng">
      <LegalSection title="1. Dịch vụ">
        <p>
          Ứng dụng giúp bạn ghi, thống kê giao dịch từ thông báo ngân hàng do chính bạn gửi lên và ước tính hoàn tiền thẻ tín dụng.
          Ứng dụng không kết nối trực tiếp với ngân hàng, không thực hiện giao dịch tiền và không phải lời khuyên tài chính.
          Số liệu (kể cả hoàn tiền) là <strong>ước tính</strong>; hãy đối chiếu với sao kê của ngân hàng.
        </p>
      </LegalSection>

      <LegalSection title="2. Tài khoản và trách nhiệm của bạn">
        <ul className="list-disc space-y-1 pl-5">
          <li>Bạn cung cấp email thật, giữ bí mật mật khẩu và API key; thu hồi key ngay khi nghi bị lộ.</li>
          <li>Chỉ gửi thông báo của tài khoản/thẻ thuộc về bạn; không dùng dịch vụ để gửi dữ liệu của người khác khi chưa được phép.</li>
          <li>Không lạm dụng (gửi tự động quá mức, dò quét, cố truy cập dữ liệu người khác). Chúng tôi có thể khoá tài khoản vi phạm.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Credit và thanh toán">
        <ul className="list-disc space-y-1 pl-5">
          <li>Mỗi giao dịch được ghi thành công trừ 1 credit. Tin tự phân loại thành giao dịch từ hộp tin cũng trừ 1 credit. Tin không đọc được, trùng, OTP hoặc không khớp tài khoản không bị trừ.</li>
          <li>Hết credit, tin hợp lệ được giữ lại (số lượng có giới hạn) và tự ghi khi bạn nạp thêm.</li>
          <li>Credit chào mừng được tặng sau khi xác nhận email. Gói nạp, giá và số credit hiển thị trong ứng dụng tại thời điểm mua.</li>
          <li>Thanh toán qua MoMo hoặc ZaloPay; credit được cộng khi cổng thanh toán xác nhận đơn.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Chính sách hoàn credit">
        <p role="note" className="rounded-lg border border-warning/50 bg-warning/10 p-3">
          Chính sách do đơn vị vận hành đặt ra, chưa qua rà soát pháp lý:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Credit đã nạp <strong>không được hoàn tiền</strong>, trừ trường hợp bị trừ tiền trùng hoặc trừ nhầm (ví dụ cổng thanh toán trừ hai lần cho một đơn, hoặc lỗi hệ thống làm mất credit).</li>
          <li>Trường hợp trên, gửi yêu cầu kèm mã đơn tới <LegalValue value={legalConfig.contactEmail} />; chúng tôi hoàn tiền về phương thức đã thanh toán hoặc cộng lại credit tương ứng.</li>
          <li>Credit không quy đổi thành tiền mặt và không chuyển nhượng.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Giới hạn trách nhiệm">
        <p>
          Dịch vụ cung cấp &quot;như hiện có&quot;. Bộ đọc thông báo có thể bỏ sót hoặc đọc sai khi ngân hàng đổi mẫu tin; chúng tôi không chịu
          trách nhiệm cho quyết định tài chính dựa trên số liệu ứng dụng, trong phạm vi pháp luật cho phép.
        </p>
      </LegalSection>

      <LegalSection title="6. Chấm dứt và thay đổi">
        <p>
          Bạn có thể xoá tài khoản bất cứ lúc nào trong Cài đặt (credit còn lại mất theo tài khoản). Chúng tôi có thể cập nhật điều khoản;
          thay đổi quan trọng được thông báo trong ứng dụng hoặc qua email.
        </p>
      </LegalSection>

      <LegalSection title="7. Liên hệ">
        <p>
          <LegalValue value={legalConfig.operatorName} /> · <LegalValue value={legalConfig.contactEmail} />. Việc xử lý dữ liệu cá nhân xem
          thêm tại Chính sách bảo mật.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
