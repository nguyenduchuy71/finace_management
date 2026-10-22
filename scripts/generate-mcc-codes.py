"""Sinh src/utils/mcc-codes.ts từ greggles/mcc-codes (mcc_codes.json) + nhãn tiếng Việt.

Dùng:
  curl -sSL https://raw.githubusercontent.com/greggles/mcc-codes/main/mcc_codes.json -o /tmp/mcc_codes.json
  python3 -I scripts/generate-mcc-codes.py /tmp/mcc_codes.json src/utils/mcc-codes.ts
"""
import json
import re
import sys

# Nhãn tiếng Việt cho mã nhóm. 16 mã đã có trong app giữ NGUYÊN nhãn cũ.
VN = {
    '0742': 'Thú y', '0763': 'Hợp tác xã nông nghiệp', '0780': 'Cảnh quan / làm vườn',
    '1520': 'Nhà thầu xây dựng', '1711': 'Nhà thầu điện lạnh / sưởi / ống nước', '1731': 'Nhà thầu điện',
    '1740': 'Nhà thầu xây, trát, cách nhiệt', '1750': 'Nhà thầu mộc', '1761': 'Nhà thầu mái, tôn',
    '1771': 'Nhà thầu bê tông', '1799': 'Nhà thầu chuyên ngành khác',
    '2741': 'In ấn / xuất bản', '2791': 'Sắp chữ, chế bản', '2842': 'Hoá chất tẩy rửa chuyên dụng',
    '4011': 'Đường sắt (hàng hoá)', '4111': 'Giao thông công cộng', '4112': 'Tàu hoả chở khách',
    '4119': 'Xe cứu thương', '4121': 'Taxi / xe công nghệ', '4131': 'Xe khách / xe du lịch',
    '4214': 'Vận tải hàng, chuyển nhà', '4215': 'Chuyển phát / giao hàng', '4225': 'Kho bãi',
    '4411': 'Du thuyền / tàu biển', '4457': 'Thuê thuyền', '4468': 'Bến du thuyền, dịch vụ hàng hải',
    '4511': 'Hãng hàng không', '4582': 'Sân bay, nhà ga hàng không', '4722': 'Đại lý du lịch / đặt tour',
    '4723': 'Tour trọn gói (Đức)', '4784': 'Phí cầu đường', '4789': 'Dịch vụ vận tải khác',
    '4812': 'Thiết bị viễn thông, điện thoại', '4814': 'Viễn thông', '4815': 'VisaPhone',
    '4816': 'Dịch vụ mạng / Internet / hosting', '4821': 'Điện tín', '4829': 'Chuyển tiền',
    '4899': 'Giải trí / Streaming', '4900': 'Điện nước',
    '5013': 'Phụ tùng xe (bán buôn)', '5021': 'Nội thất văn phòng', '5039': 'Vật liệu xây dựng khác',
    '5044': 'Thiết bị văn phòng, máy photo', '5045': 'Máy tính, phần mềm (bán buôn)',
    '5046': 'Thiết bị thương mại khác', '5047': 'Thiết bị y tế, nha khoa',
    '5051': 'Kim loại', '5065': 'Linh kiện điện', '5072': 'Dụng cụ phần cứng (bán buôn)',
    '5074': 'Thiết bị ống nước, sưởi', '5085': 'Vật tư công nghiệp', '5094': 'Đá quý, kim loại quý, đồng hồ (bán buôn)',
    '5099': 'Hàng lâu bền khác', '5111': 'Giấy, văn phòng phẩm (bán buôn)', '5122': 'Dược phẩm (bán buôn)',
    '5131': 'Vải, phụ liệu may', '5137': 'Đồng phục', '5139': 'Giày dép (bán buôn)',
    '5169': 'Hoá chất', '5172': 'Xăng dầu (bán buôn)', '5192': 'Sách báo (bán buôn)',
    '5193': 'Hoa, cây giống (bán buôn)', '5198': 'Sơn, vecni', '5199': 'Hàng tiêu dùng khác (bán buôn)',
    '5200': 'Kho vật tư nhà cửa', '5211': 'Vật liệu xây dựng, gỗ', '5231': 'Kính, sơn, giấy dán tường',
    '5251': 'Cửa hàng kim khí, dụng cụ', '5261': 'Vườn ươm, đồ làm vườn', '5262': 'Sàn thương mại điện tử (marketplace)',
    '5271': 'Nhà di động', '5300': 'Câu lạc bộ mua sỉ', '5309': 'Cửa hàng miễn thuế',
    '5310': 'Cửa hàng giá rẻ', '5311': 'Bách hóa / Trung tâm thương mại', '5331': 'Cửa hàng tạp hoá đồng giá',
    '5399': 'Hàng hoá tổng hợp khác', '5411': 'Siêu thị', '5422': 'Thịt, thực phẩm đông lạnh',
    '5441': 'Bánh kẹo, hạt', '5451': 'Sữa, chế phẩm sữa', '5462': 'Tiệm bánh',
    '5499': 'Cửa hàng tiện lợi / thực phẩm chuyên doanh', '5511': 'Đại lý ô tô (mới & cũ)',
    '5521': 'Đại lý ô tô cũ', '5531': 'Cửa hàng đồ ô tô', '5532': 'Lốp xe', '5533': 'Phụ tùng, phụ kiện ô tô',
    '5541': 'Xăng dầu', '5542': 'Trạm xăng tự động', '5551': 'Đại lý thuyền',
    '5552': 'Trạm sạc xe điện', '5561': 'Rơ-moóc, xe cắm trại', '5571': 'Đại lý xe máy',
    '5592': 'Đại lý nhà xe (motorhome)', '5598': 'Đại lý xe trượt tuyết', '5599': 'Đại lý xe khác',
    '5611': 'Thời trang nam', '5621': 'Thời trang nữ may sẵn', '5631': 'Phụ kiện nữ',
    '5641': 'Đồ trẻ em, mẹ & bé', '5651': 'Quần áo', '5655': 'Đồ thể thao, đồ cưỡi ngựa',
    '5661': 'Giày dép', '5681': 'Đồ lông thú', '5691': 'Thời trang nam nữ',
    '5697': 'May đo, sửa quần áo', '5698': 'Tóc giả', '5699': 'Phụ kiện thời trang khác',
    '5712': 'Nội thất, đồ gia dụng', '5713': 'Sàn, thảm trải', '5714': 'Rèm, vải bọc',
    '5718': 'Lò sưởi, phụ kiện', '5719': 'Đồ trang trí nhà cửa', '5722': 'Đồ điện gia dụng',
    '5732': 'Điện tử', '5733': 'Nhạc cụ', '5734': 'Phần mềm máy tính', '5735': 'Đĩa nhạc',
    '5811': 'Dịch vụ nấu tiệc', '5812': 'Nhà hàng', '5813': 'Quán bar, pub, đồ uống có cồn',
    '5814': 'Đồ ăn nhanh / cafe', '5815': 'Nội dung số: sách, phim, nhạc', '5816': 'Nội dung số: game',
    '5817': 'Nội dung số: ứng dụng', '5818': 'Nội dung số: nhà cung cấp lớn',
    '5832': 'Đồ cổ (mua bán, phục chế)', '5912': 'Nhà thuốc', '5921': 'Bia rượu',
    '5931': 'Đồ cũ, đồ si', '5932': 'Đồ cổ', '5933': 'Tiệm cầm đồ', '5935': 'Bãi phế liệu',
    '5937': 'Đồ cổ phục chế', '5940': 'Xe đạp', '5941': 'Dụng cụ thể thao',
    '5942': 'Sách / Văn phòng phẩm', '5943': 'Văn phòng phẩm, đồ dùng học tập',
    '5944': 'Trang sức, đồng hồ', '5945': 'Đồ chơi, game, sở thích', '5946': 'Máy ảnh, đồ nhiếp ảnh',
    '5947': 'Quà tặng, lưu niệm', '5948': 'Đồ da, túi xách', '5949': 'Vải, đồ may vá',
    '5950': 'Đồ thuỷ tinh, pha lê', '5960': 'Bán bảo hiểm trực tiếp', '5961': 'Đặt hàng qua thư / catalog',
    '5962': 'Bán dịch vụ du lịch trực tiếp', '5963': 'Bán hàng tận nhà', '5964': 'Bán hàng qua catalog',
    '5965': 'Catalog & cửa hàng', '5966': 'Telesales gọi ra', '5967': 'Telesales gọi vào',
    '5968': 'Thuê bao / gói định kỳ', '5969': 'Bán hàng trực tiếp khác', '5970': 'Hoạ cụ, đồ thủ công',
    '5971': 'Phòng tranh, mua bán tác phẩm nghệ thuật', '5972': 'Tem, tiền xu sưu tầm', '5973': 'Đồ tôn giáo',
    '5975': 'Máy trợ thính', '5976': 'Dụng cụ chỉnh hình', '5977': 'Mỹ phẩm',
    '5978': 'Máy đánh chữ', '5983': 'Nhiên liệu (gas, than, củi)', '5992': 'Hoa tươi',
    '5993': 'Thuốc lá', '5994': 'Sạp báo', '5995': 'Thú cưng, đồ thú cưng',
    '5996': 'Bể bơi (thiết bị, dịch vụ)', '5997': 'Máy cạo râu điện', '5998': 'Lều, mái che',
    '5999': 'Cửa hàng chuyên doanh khác',
    '6010': 'Rút tiền mặt tại quầy', '6011': 'Rút tiền mặt ATM', '6012': 'Tổ chức tài chính (hàng hoá, dịch vụ)',
    '6050': 'Giao dịch tương đương tiền mặt', '6051': 'Ngoại tệ, tiền điện tử, quy đổi tiền',
    '6211': 'Môi giới chứng khoán', '6300': 'Bảo hiểm', '6381': 'Phí bảo hiểm (mã cũ)',
    '6399': 'Bảo hiểm khác (mã cũ)', '6513': 'Môi giới, cho thuê bất động sản',
    '6532': 'Nhận tiền (tổ chức tài chính)', '6533': 'Nhận tiền (merchant)',
    '6534': 'Chuyển tiền (tổ chức tài chính)', '6535': 'Nạp giá trị (tổ chức tài chính)',
    '6536': 'Chuyển tiền MoneySend nội địa', '6537': 'Chuyển tiền MoneySend quốc tế',
    '6538': 'Nạp tiền MoneySend', '6540': 'Nạp ví điện tử / thẻ trả trước',
    '7011': 'Khách sạn / lưu trú', '7012': 'Timeshare (sở hữu kỳ nghỉ)', '7032': 'Trại thể thao, giải trí',
    '7033': 'Khu cắm trại, bãi đỗ nhà xe', '7210': 'Giặt ủi, chăm sóc quần áo', '7211': 'Giặt là',
    '7216': 'Giặt khô', '7217': 'Giặt thảm, ghế sofa', '7221': 'Studio chụp ảnh',
    '7230': 'Salon tóc, làm đẹp', '7251': 'Sửa giày, đánh giày', '7261': 'Dịch vụ tang lễ',
    '7273': 'Dịch vụ hẹn hò', '7276': 'Dịch vụ khai thuế', '7277': 'Tư vấn (nợ, hôn nhân, cá nhân)',
    '7278': 'Dịch vụ mua hộ, câu lạc bộ mua sắm', '7280': 'Bệnh viện: dịch vụ cho bệnh nhân',
    '7296': 'Cho thuê trang phục', '7297': 'Massage', '7298': 'Spa, chăm sóc sắc đẹp',
    '7299': 'Dịch vụ cá nhân khác', '7311': 'Quảng cáo', '7321': 'Thông tin tín dụng',
    '7322': 'Thu hồi nợ', '7332': 'In bản vẽ, photocopy', '7333': 'Nhiếp ảnh thương mại, đồ hoạ',
    '7338': 'Photocopy nhanh', '7339': 'Thư ký, đánh máy', '7342': 'Diệt côn trùng, khử trùng',
    '7349': 'Vệ sinh, bảo trì toà nhà', '7361': 'Tuyển dụng, lao động thời vụ',
    '7372': 'Lập trình, xử lý dữ liệu, dịch vụ IT', '7375': 'Dịch vụ tra cứu thông tin',
    '7379': 'Sửa chữa, bảo trì máy tính', '7392': 'Tư vấn quản lý, PR', '7393': 'Bảo vệ, an ninh',
    '7394': 'Cho thuê thiết bị, dụng cụ', '7395': 'Rửa ảnh', '7399': 'Dịch vụ doanh nghiệp khác',
    '7511': 'Trạm dừng xe tải', '7512': 'Thuê ô tô', '7513': 'Thuê xe tải, rơ-moóc',
    '7519': 'Thuê nhà xe', '7523': 'Bãi đỗ xe', '7531': 'Sửa thân vỏ ô tô', '7534': 'Vá, đắp lốp',
    '7535': 'Sơn ô tô', '7538': 'Bảo dưỡng, sửa chữa ô tô', '7542': 'Rửa xe', '7549': 'Cứu hộ, kéo xe',
    '7622': 'Sửa radio, TV', '7623': 'Sửa điều hoà, tủ lạnh', '7629': 'Sửa đồ điện gia dụng nhỏ',
    '7631': 'Sửa đồng hồ, trang sức', '7641': 'Sửa, bọc lại nội thất', '7692': 'Hàn sửa chữa',
    '7699': 'Sửa chữa khác', '7800': 'Xổ số nhà nước (Mỹ)', '7801': 'Casino trực tuyến được cấp phép',
    '7802': 'Đua ngựa / đua chó được cấp phép', '7829': 'Sản xuất, phát hành phim',
    '7832': 'Rạp phim', '7841': 'Cho thuê băng đĩa', '7911': 'Khiêu vũ, trường dạy nhảy',
    '7922': 'Bán vé sự kiện, nhà hát', '7929': 'Ban nhạc, nghệ sĩ biểu diễn', '7932': 'Bi-a',
    '7933': 'Bowling', '7941': 'Thể thao chuyên nghiệp, sân vận động', '7991': 'Điểm tham quan, triển lãm',
    '7992': 'Sân golf công cộng', '7993': 'Thiết bị trò chơi điện tử', '7994': 'Khu trò chơi điện tử',
    '7995': 'Cá cược, xổ số, casino', '7996': 'Công viên giải trí', '7997': 'Câu lạc bộ thể thao, gym',
    '7998': 'Thuỷ cung', '7999': 'Dịch vụ giải trí khác',
    '8011': 'Y tế', '8021': 'Nha khoa', '8031': 'Nắn xương (osteopath)', '8041': 'Chỉnh hình cột sống (chiropractic)',
    '8042': 'Khám mắt', '8043': 'Kính mắt', '8044': 'Kính mắt (mã cũ)', '8049': 'Chăm sóc bàn chân',
    '8050': 'Viện dưỡng lão, chăm sóc', '8062': 'Bệnh viện', '8071': 'Phòng xét nghiệm y tế, nha khoa',
    '8099': 'Dịch vụ y tế khác', '8111': 'Luật sư, dịch vụ pháp lý', '8211': 'Trường phổ thông',
    '8220': 'Đại học, cao đẳng', '8241': 'Học từ xa', '8244': 'Trường kinh doanh, thư ký',
    '8249': 'Trường nghề', '8299': 'Giáo dục, đào tạo khác', '8351': 'Trông trẻ, nhà trẻ',
    '8398': 'Từ thiện, tổ chức xã hội', '8641': 'Hội đoàn, câu lạc bộ dân sự', '8651': 'Tổ chức chính trị',
    '8661': 'Tổ chức tôn giáo', '8675': 'Hiệp hội ô tô', '8699': 'Tổ chức hội viên khác',
    '8734': 'Phòng thí nghiệm (phi y tế)', '8911': 'Kiến trúc, kỹ thuật, khảo sát',
    '8931': 'Kế toán, kiểm toán', '8999': 'Dịch vụ chuyên môn khác',
    '9211': 'Án phí, cấp dưỡng', '9222': 'Tiền phạt', '9223': 'Tiền bảo lãnh, tại ngoại',
    '9311': 'Nộp thuế', '9399': 'Dịch vụ công khác', '9402': 'Bưu chính nhà nước',
    '9405': 'Giao dịch nội bộ chính phủ', '9406': 'Xổ số nhà nước',
    '9700': 'Dịch vụ giới thiệu tự động (Visa)', '9701': 'Dịch vụ xác thực (Visa)',
    '9702': 'Dịch vụ khẩn cấp GCAS (Visa)', '9950': 'Mua hàng nội bộ công ty (Visa)',
}

# Mã mới (sau bản dữ liệu nguồn) — có trong Visa/Mastercard hiện hành, hay gặp trong rule/loại trừ của ngân hàng.
EXTRA = ['5262', '5552', '6050', '6532', '6533', '6534', '6535', '6536', '6537', '6538', '6540', '7280', '7322', '9406']


def brand_prefix(code: int) -> str:
    if code <= 3350:
        return 'Hãng bay'
    if code <= 3500:
        return 'Thuê xe'
    return 'Khách sạn'


def clean_brand(desc: str) -> str:
    # "UNITED AIRLINES" / "Hilton Hotels" ... -> bỏ khoảng trắng thừa, giữ nguyên tên hãng.
    return re.sub(r'\s+', ' ', desc).strip(' ,')


def main(src: str, out: str) -> None:
    data = json.load(open(src, encoding='utf-8'))
    rows: dict[str, str] = {}
    for x in data:
        code = x['mcc']
        n = int(code)
        if 3000 <= n <= 3999:
            rows[code] = f"{brand_prefix(n)} · {clean_brand(x['edited_description'])}"
        else:
            if code not in VN:
                raise SystemExit(f'thiếu nhãn VN cho {code}: {x["edited_description"]}')
            rows[code] = VN[code]
    for code in EXTRA:
        if code in rows:
            raise SystemExit(f'{code} đã có trong nguồn, bỏ khỏi EXTRA')
        rows[code] = VN[code]
    unused = set(VN) - set(rows)
    if unused:
        raise SystemExit(f'nhãn VN thừa: {sorted(unused)}')

    lines = [
        '/**',
        ' * Danh sách MCC (ISO 18245) đầy đủ: [mã, nhãn tiếng Việt]. FILE SINH TỰ ĐỘNG — đừng sửa tay từng dòng,',
        ' * sửa scripts/generate-mcc-codes.py rồi chạy lại.',
        ' *',
        ' * Nguồn: github.com/greggles/mcc-codes (tổng hợp Visa/Mastercard/IRS) + mã mới bổ sung tay',
        f' * ({", ".join(EXTRA)}). Mã 3000–3999 là mã riêng của từng hãng bay / hãng thuê xe / chuỗi',
        ' * khách sạn, giữ tên hãng gốc.',
        ' */',
        'export const MCC_CODES: readonly (readonly [code: string, label: string])[] = [',
    ]
    for code in sorted(rows):
        label = rows[code].replace('\\', '\\\\').replace("'", "\\'")
        lines.append(f"  ['{code}', '{label}'],")
    lines.append(']')
    open(out, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(f'{len(rows)} mã -> {out}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
