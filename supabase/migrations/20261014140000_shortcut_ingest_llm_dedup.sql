-- Hỗ trợ thu giao dịch từ MỌI ngân hàng qua iOS Shortcut (trigger Notification của iOS 27).
-- Hướng dẫn setup: docs/ios-shortcut-setup.md

-- ---------------------------------------------------------------------------
-- 1. transactions.parsed_by — giao dịch do regex hay do Claude bóc tách
--
-- Regex đã kiểm chứng bằng mẫu thật; LLM thì chưa. Đánh dấu để lọc ra rà soát
-- (`where parsed_by = 'llm'`) và biết bank nào nên viết regex thay thế.
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists parsed_by text not null default 'regex'
  check (parsed_by in ('regex', 'llm'));

-- ---------------------------------------------------------------------------
-- 2. Index cho chống trùng
--
-- Edge function bỏ qua tin có cùng raw_text đã ghi trong 10 phút gần nhất
-- (Shortcut gửi lại / automation chạy 2 lần). Query lọc (user_id, created_at).
-- ---------------------------------------------------------------------------
create index if not exists idx_tx_user_created
  on public.transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. unparsed_messages: biết tin đến từ app nào và vì sao bị loại
--
-- source: tên bank do automation của Shortcut gửi kèm (mỗi app 1 automation).
-- reason: no_match | not_transaction | non_vnd | amount_not_in_text | llm_error ...
-- ---------------------------------------------------------------------------
alter table public.unparsed_messages
  add column if not exists source text,
  add column if not exists reason text;
