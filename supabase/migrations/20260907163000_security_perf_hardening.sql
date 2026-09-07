-- Siết bảo mật + hiệu năng sau audit 2026-09-07.
-- Chi tiết từng phát hiện: plans/reports/scout-260907-1614-security-performance-audit.md

-- ---------------------------------------------------------------------------
-- 1. transactions.user_id: NOT NULL
--
-- Row có user_id = NULL thì `auth.uid() = user_id` ra NULL -> KHÔNG policy nào
-- match -> user không đọc/sửa/xoá được, dashboard cũng không đếm. Nó tích tụ âm
-- thầm và giữ PII trong raw_text vĩnh viễn, chỉ service_role dọn được.
-- accounts.user_id / credit_cards.user_id đã là not null từ đầu; đây là chỗ sót.
-- Đã kiểm tra production: 0 row user_id null, nên set not null an toàn.
-- ---------------------------------------------------------------------------
alter table public.transactions
  alter column user_id set not null;

-- ---------------------------------------------------------------------------
-- 2. Index khớp đúng thứ tự sắp xếp của keyset pagination
--
-- App order by (transaction_date desc, id desc) và lọc theo account_id/card_id.
-- Index cũ thiếu `id` -> Postgres dùng được prefix nhưng vẫn phải sort trong mỗi
-- nhóm cùng transaction_date. Thêm id vào đuôi để index phục vụ trọn vẹn.
-- ---------------------------------------------------------------------------
create index if not exists idx_tx_account_date_id
  on public.transactions (account_id, transaction_date desc, id desc);
create index if not exists idx_tx_card_date_id
  on public.transactions (card_id, transaction_date desc, id desc);

-- Index cũ giờ là tập con của 2 index trên -> chỉ tốn write amplification.
drop index if exists public.idx_tx_account_date;
drop index if exists public.idx_tx_card_date;

-- ---------------------------------------------------------------------------
-- 3. Drop 2 index chết
--
-- idx_transactions_bank (bank_name): không query nào trong src/services/ lọc
--   transactions theo bank_name (edge function lọc accounts/credit_cards, khác bảng).
-- idx_transactions_date (transaction_date): trùng prefix của idx_tx_user_date
--   với mọi query đã qua RLS (RLS luôn thêm user_id = auth.uid()).
-- ---------------------------------------------------------------------------
drop index if exists public.idx_transactions_bank;
drop index if exists public.idx_transactions_date;

-- ---------------------------------------------------------------------------
-- 4. get_dashboard_stats: 8 lượt quét -> 1 lượt
--
-- Bản cũ tham chiếu CTE `filtered` từ 8 subquery độc lập. Viết lại bằng
-- `sum(...) filter (where ...)` để chỉ quét 1 lần. Giữ NGUYÊN:
--   - security invoker (bắt buộc: definer sẽ bypass RLS và rò dữ liệu giữa user)
--   - set search_path = public
--   - hình dạng JSON khớp DashboardStatsSchema ở frontend
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_stats(
  p_date_from timestamptz default null,
  p_date_to   timestamptz default null
)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select amount, source_type, category
    from public.transactions
    where (p_date_from is null or transaction_date >= p_date_from)
      and (p_date_to   is null or transaction_date <= p_date_to)
  ),
  -- 1 lượt quét duy nhất cho toàn bộ số tổng
  totals as (
    select
      coalesce(sum(amount) filter (where amount > 0), 0)                                   as total_income,
      coalesce(abs(sum(amount) filter (where amount < 0)), 0)                              as total_expense,
      coalesce(sum(amount) filter (where amount > 0 and source_type = 'bank'), 0)          as bank_income,
      coalesce(abs(sum(amount) filter (where amount < 0 and source_type = 'bank')), 0)     as bank_expense,
      coalesce(sum(amount) filter (where amount > 0 and source_type = 'credit_card'), 0)   as cc_income,
      coalesce(abs(sum(amount) filter (where amount < 0 and source_type = 'credit_card')), 0) as cc_expense,
      count(*)                                                                             as tx_count
    from filtered
  ),
  breakdown as (
    select coalesce(json_agg(json_build_object('category', cat, 'amount', abs(total))), '[]'::json) as data
    from (
      select coalesce(category, 'Khác') as cat, sum(amount) as total
      from filtered
      where amount < 0
      group by coalesce(category, 'Khác')
    ) c
  )
  select json_build_object(
    'totalIncome',       t.total_income,
    'totalExpense',      t.total_expense,
    'bankIncome',        t.bank_income,
    'bankExpense',       t.bank_expense,
    'ccIncome',          t.cc_income,
    'ccExpense',         t.cc_expense,
    'categoryBreakdown', b.data,
    'transactionCount',  t.tx_count
  )
  from totals t, breakdown b;
$$;

grant execute on function public.get_dashboard_stats(timestamptz, timestamptz)
  to authenticated;
