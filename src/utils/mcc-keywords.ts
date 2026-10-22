/**
 * Từ khoá trong tên merchant để GỢI Ý MCC (xem `suggestMcc` ở mcc.ts). Chỉ các mã hay gặp ở VN có
 * từ khoá; mã còn lại vẫn chọn được bằng tìm kiếm.
 *
 * Quy ước: không dấu, chữ thường, KHÔNG thừa khoảng trắng ở hai đầu (mọi từ khoá khớp theo ranh giới
 * từ). Dấu `& . !` được giữ; `-` và khoảng trắng đều thành khoảng trắng nên viết "co op", "7 eleven".
 * Từ khoá nhập nhằng cố ý KHÔNG có: "gas" (khí đốt / trạm xăng), "metro" (tàu điện / siêu thị sỉ),
 * "thue" (thuê / thuế), "chua" (chùa / chưa), "bar" (quán bar / "Sushi Bar"), địa điểm như "Vincom".
 */
export const MCC_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  // 16 mục ban đầu — giữ nguyên để gợi ý cũ không đổi.
  '5411': ['winmart', 'bach hoa xanh', 'coopmart', 'coop food', 'co.op', 'co op', 'big c', 'go!', 'lotte mart', 'aeon', 'mega market', 'emart', 'satra', 'tops market', 'bhx'],
  '5812': ['restaurant', 'nha hang', 'quan an', 'pizza', 'buffet', 'sushi', 'lau', 'bbq', 'pho'],
  '5814': ['highlands', 'highland', 'the coffee house', 'phuc long', 'starbucks', 'cong ca phe', 'trung nguyen', 'kfc', 'lotteria', 'jollibee', 'mcdonald', 'burger king', 'circle k', 'cafe', 'coffee', 'ca phe', 'tra sua', 'gongcha', 'grabfood', 'shopeefood', 'baemin'],
  '5541': ['petrolimex', 'pvoil', 'pv oil', 'xang dau', 'cay xang', 'shell', 'caltex', 'comeco'],
  '4121': ['grab', 'gojek', 'xanh sm', 'be', 'be group', 'mai linh', 'vinasun', 'taxi'],
  '4111': ['xe buyt', 'bus', 'vetc', 'epass', 'phi cau duong'],
  '5311': ['shopee', 'lazada', 'tiki', 'sendo', 'tiktok shop'],
  '5651': ['uniqlo', 'zara', 'h&m', 'canifa', 'owen', 'routine', 'yame', 'coolmate', 'thoi trang', 'fashion'],
  '5732': ['the gioi di dong', 'thegioididong', 'dien may xanh', 'fpt shop', 'cellphones', 'cps', 'nguyen kim', 'pico', 'apple', 'samsung', 'hoang ha mobile', 'phong vu', 'gearvn', 'di dong viet'],
  '5942': ['fahasa', 'nha sach', 'phuong nam', 'thien long', 'hong ha', 'sach'],
  '5912': ['pharmacity', 'long chau', 'an khang', 'nha thuoc', 'guardian', 'medicare'],
  '8011': ['benh vien', 'phong kham', 'hospital', 'clinic', 'vinmec', 'y te', 'nha khoa', 'medlatec'],
  '4899': ['netflix', 'spotify', 'youtube', 'disney', 'apple music', 'icloud', 'google one', 'fpt play', 'vieon', 'tv360', 'steam', 'playstation', 'app store', 'google play'],
  '7832': ['cgv', 'lotte cinema', 'galaxy cinema', 'bhd', 'beta cinemas', 'rap phim', 'cinema'],
  '4900': ['evn', 'dien luc', 'cap nuoc', 'sawaco', 'tien dien', 'tien nuoc'],
  '4814': ['viettel', 'vinaphone', 'mobifone', 'vietnamobile', 'fpt telecom', 'vnpt', 'nap tien dien thoai', 'internet'],

  // Di chuyển / du lịch
  '4511': ['vietnam airlines', 'vietjet', 'bamboo airways', 'vietravel airlines', 'pacific airlines', 'airasia'],
  '4582': ['san bay', 'airport'],
  '4112': ['duong sat', 'dsvn', 've tau'],
  '4131': ['futa', 'phuong trang', 'xe khach', 'thanh buoi'],
  '4215': ['giao hang nhanh', 'ghn', 'ghtk', 'viettel post', 'vnpost', 'buu dien', 'ahamove', 'lalamove'],
  '4411': ['du thuyen', 'cruise'],
  '4722': ['agoda', 'booking.com', 'traveloka', 'klook', 'vietravel', 'saigontourist'],
  '7011': ['hotel', 'khach san', 'resort', 'homestay'],
  '7512': ['thue xe', 'thue o to', 'car rental'],
  '7523': ['bai do xe', 'gui xe', 'parking'],
  '7538': ['gara', 'garage', 'sua xe', 'bao duong'],
  '7542': ['rua xe', 'car wash'],
  '5511': ['vinfast', 'toyota', 'hyundai', 'mazda', 'ford'],
  '5571': ['xe may', 'head honda', 'yamaha town'],
  '5552': ['tram sac', 'sac xe dien'],

  // Mua sắm
  '5262': ['marketplace'],
  '5309': ['duty free', 'mien thue'],
  '5331': ['daiso', 'miniso', 'mumuso'],
  '5451': ['vinamilk', 'th true milk'],
  '5462': ['tous les jours', 'abc bakery', 'paris baguette', 'breadtalk', 'tiem banh'],
  '5499': ['7 eleven', 'familymart', 'ministop', 'gs25'],
  '5641': ['con cung', 'kids plaza', 'bibo mart'],
  '5661': ['bitis', 'giay dep', 'ananas'],
  '5712': ['ikea', 'nha xinh', 'noi that', 'jysk', 'baya'],
  '5722': ['dien may', 'dien may cho lon', 'media mart'],
  '5734': ['microsoft', 'adobe', 'openai', 'chatgpt'],
  '5816': ['garena', 'roblox', 'riot games'],
  '5921': ['ruou', 'wine shop', 'liquor'],
  '5941': ['decathlon', 'supersports', 'the thao'],
  '5944': ['pnj', 'doji', 'sjc', 'bao tin minh chau', 'trang suc'],
  '5945': ['do choi', 'mykingdom', 'lego', 'toys'],
  '5946': ['may anh'],
  '5947': ['qua tang', 'luu niem', 'gift shop', 'souvenir'],
  '5948': ['tui xach', 'do da'],
  '5977': ['hasaki', 'watsons', 'the face shop', 'innisfree', 'sephora', 'my pham'],
  '5992': ['hoa tuoi', 'flower'],
  '5995': ['pet mart', 'petmart', 'thu cung'],
  '5813': ['pub', 'bia hoi', 'beer club'],
  '5811': ['tiec cuoi', 'nau tiec', 'catering'],
  '8043': ['kinh mat', 'mat kinh'],

  // Dịch vụ
  '4816': ['aws', 'amazon web services', 'google cloud', 'digitalocean', 'hosting', 'ten mien'],
  '7210': ['giat la', 'giat ui', 'laundry'],
  '7221': ['chup anh', 'studio anh'],
  '7230': ['salon', 'cat toc', 'barber', '30shine'],
  '7298': ['spa', 'tham my vien'],
  '7311': ['quang cao', 'facebk', 'google ads'],
  '7922': ['ticketbox'],
  '7996': ['vinwonders', 'sun world', 'dam sen', 'suoi tien', 'cong vien'],
  '7997': ['gym', 'fitness', 'yoga', 'california fitness'],
  '8220': ['dai hoc', 'university'],
  '8299': ['ielts', 'toeic', 'anh ngu', 'ngoai ngu', 'apollo english'],
  '8351': ['nha tre'],
  '8398': ['tu thien', 'unicef'],

  // Tài chính / nhà nước
  '6011': ['atm', 'rut tien'],
  '6051': ['binance', 'ngoai te', 'doi tien'],
  '6211': ['chung khoan', 'ssi', 'vndirect', 'tcbs'],
  '6300': ['bao hiem', 'prudential', 'manulife', 'bao viet', 'aia', 'dai ichi'],
  '6513': ['bat dong san', 'tien nha', 'thue nha'],
  '6540': ['momo', 'zalopay', 'shopeepay', 'vi dien tu', 'nap vi'],
  '9311': ['nop thue', 'thue tncn', 'tong cuc thue'],
  '9399': ['dich vu cong'],
}
