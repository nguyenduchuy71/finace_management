import { legalConfig } from '@/config/legal-config'
import { SUPPORTED_BANKS } from '@/config/supported-banks'
import { LegalLayout, LegalSection, LegalValue } from './LegalLayout'

/** Chính sách bảo mật (/privacy). Đổi nội dung thì tăng PRIVACY_POLICY_VERSION (src/types/api-key.ts). */
export default function PrivacyPage() {
  return (
    <LegalLayout title="Chính sách bảo mật">
      <LegalSection title="1. Đơn vị xử lý dữ liệu">
        <p>
          Dữ liệu cá nhân của bạn được xử lý bởi <LegalValue value={legalConfig.operatorName} /> (&quot;chúng tôi&quot;).
          Liên hệ về dữ liệu cá nhân: <LegalValue value={legalConfig.contactEmail} />.
        </p>
      </LegalSection>

      <LegalSection title="2. Dữ liệu chúng tôi thu thập">
        <ul className="list-disc space-y-1 pl-5">
          <li>Tài khoản: địa chỉ email, mật khẩu (chỉ lưu dạng băm bởi dịch vụ xác thực), thời điểm và phiên bản chính sách bạn đồng ý.</li>
          <li>
            Nội dung thông báo ngân hàng (SMS, thông báo ứng dụng, email) mà iOS Shortcut của bạn gửi lên: số tiền, số dư,
            4 số cuối tài khoản/thẻ, tên người giao dịch, nội dung chuyển khoản.
          </li>
          <li>Giao dịch được ghi từ thông báo, tài khoản và thẻ bạn khai báo (chỉ 4 số cuối), mã MCC và quy tắc hoàn tiền bạn nhập.</li>
          <li>API key dùng cho Shortcut: chỉ lưu giá trị băm SHA-256 cùng 6 ký tự đầu và 4 ký tự cuối để bạn nhận ra key; không thể khôi phục key gốc.</li>
          <li>Đơn nạp credit: mã đơn, số tiền, cổng thanh toán, trạng thái. Chúng tôi không nhận số thẻ hay thông tin ví của bạn.</li>
          <li>Nhật ký kỹ thuật cần cho an ninh và chống lạm dụng (số lần gọi API theo key, thời điểm dùng gần nhất).</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Mục đích xử lý">
        <p>
          Ghi và thống kê giao dịch của riêng bạn, tính hoàn tiền ước tính, trừ và hoàn credit, xử lý thanh toán, bảo mật tài khoản,
          hỗ trợ và đo chất lượng bộ đọc thông báo (số liệu tổng hợp theo ngân hàng, không xem nội dung giao dịch của bạn).
          Chúng tôi không bán dữ liệu và không dùng dữ liệu cho quảng cáo.
        </p>
      </LegalSection>

      <LegalSection title="4. Thời gian lưu trữ">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Nguyên văn thông báo (<code>raw_text</code>) của giao dịch và của tin đã xử lý trong hộp tin được <strong>xoá sau 30 ngày</strong> tự động.
            Tin chưa xử lý (đang chờ bạn phân loại hoặc chờ nạp credit) được giữ tới khi xử lý xong, rồi tính 30 ngày.
          </li>
          <li>Giao dịch đã ghi, tài khoản, thẻ, cài đặt: lưu tới khi bạn xoá hoặc xoá tài khoản.</li>
          <li>Khi bạn xoá tài khoản trong Cài đặt, toàn bộ dữ liệu của bạn bị xoá. Sổ credit và đơn thanh toán đi theo tài khoản; chứng từ bắt buộc theo luật kế toán (nếu có) được giữ theo thời hạn luật định.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Quyền của bạn">
        <ul className="list-disc space-y-1 pl-5">
          <li>Truy cập và xuất dữ liệu: xem trực tiếp trong ứng dụng, xuất giao dịch ra CSV.</li>
          <li>Chỉnh sửa: sửa giao dịch, tài khoản, thẻ, tên chủ tài khoản trong ứng dụng.</li>
          <li>Xoá: xoá từng giao dịch, tài khoản, thẻ hoặc xoá toàn bộ tài khoản trong Cài đặt.</li>
          <li>Rút lại đồng ý, hạn chế hoặc phản đối xử lý, khiếu nại: gửi yêu cầu tới <LegalValue value={legalConfig.contactEmail} />. Rút lại đồng ý đồng nghĩa với việc không thể tiếp tục dùng dịch vụ.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Bên xử lý và nơi lưu trữ">
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase: cơ sở dữ liệu, xác thực, chức năng máy chủ. Vùng lưu dữ liệu: <LegalValue value={legalConfig.dataRegion} />.</li>
          <li>Vercel: phân phối giao diện web (không lưu dữ liệu giao dịch).</li>
          <li>MoMo, ZaloPay: xử lý thanh toán khi bạn nạp credit; chúng tôi chỉ nhận kết quả đơn hàng.</li>
          <li>
            Anthropic: <strong>chỉ khi bạn tự bật trợ lý chat bằng API key của chính bạn</strong>. Khi bạn gửi câu hỏi, trình duyệt của bạn gửi
            thẳng tới Anthropic câu hỏi cùng danh sách tối đa 20 giao dịch đang hiển thị (ngày, tên cửa hàng hoặc mô tả giao dịch, số tiền).
            Không qua máy chủ của chúng tôi, không gồm nguyên văn thông báo. API key chat lưu trên trình duyệt của bạn.
          </li>
        </ul>
        <p>Dữ liệu có thể được xử lý ở nước ngoài tuỳ vùng đặt máy chủ; chúng tôi chỉ dùng các bên có biện pháp bảo mật phù hợp.</p>
      </LegalSection>

      <LegalSection title="7. Ngân hàng và nguồn thông báo được hỗ trợ">
        <ul aria-label="Ngân hàng được hỗ trợ" className="flex flex-wrap gap-2">
          {SUPPORTED_BANKS.map((bank) => (
            <li key={bank} className="rounded-full border bg-card px-3 py-1">{bank}</li>
          ))}
        </ul>
        <p>Danh sách có thể thay đổi. Thông báo không đọc được sẽ nằm trong hộp tin để bạn tự phân loại.</p>
      </LegalSection>

      <LegalSection title="8. Bảo mật">
        <p>
          Mỗi người dùng chỉ truy cập được dữ liệu của mình (kiểm soát ở tầng cơ sở dữ liệu), kết nối được mã hoá, API key được băm,
          quản trị viên chỉ xem được thông tin tài khoản, không xem số tiền hay nội dung giao dịch. Không có hệ thống nào an toàn tuyệt đối;
          nếu xảy ra sự cố ảnh hưởng dữ liệu cá nhân, chúng tôi sẽ thông báo theo quy định pháp luật.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
