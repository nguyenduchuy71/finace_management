-- Bỏ Claude fallback khỏi edge function parse-transaction -> mọi giao dịch đều do
-- regex parser ghi, cột phân biệt regex/llm không còn ý nghĩa.
-- (Thêm ở 20261014140000; chưa từng có row 'llm' trên production.)
alter table public.transactions
  drop column if exists parsed_by;
