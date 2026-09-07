-- Phase 4 — Row Level Security.
--
-- Frontend gọi Supabase trực tiếp bằng anon key, và anon key NẰM TRONG BUNDLE JS
-- của browser (ai cũng đọc được). RLS là lớp bảo vệ DUY NHẤT.
--
-- Lưu ý: `transactions` đã `enable row level security` từ trước nhưng KHÔNG có
-- policy nào -> hiện tại không ai đọc được trừ service_role. Migration này thêm
-- policy để user đọc được data của chính mình.

alter table public.transactions      enable row level security;
alter table public.accounts          enable row level security;
alter table public.credit_cards      enable row level security;
alter table public.unparsed_messages enable row level security;

-- ---------------------------------------------------------------------------
-- transactions
-- `update` cần CẢ `using` LẪN `with check`: thiếu `with check` thì user đổi được
-- user_id của row sang người khác.
-- ---------------------------------------------------------------------------
drop policy if exists "own_tx_select" on public.transactions;
create policy "own_tx_select" on public.transactions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own_tx_insert" on public.transactions;
create policy "own_tx_insert" on public.transactions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own_tx_update" on public.transactions;
create policy "own_tx_update" on public.transactions
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_tx_delete" on public.transactions;
create policy "own_tx_delete" on public.transactions
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
drop policy if exists "own_acc_select" on public.accounts;
create policy "own_acc_select" on public.accounts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own_acc_update" on public.accounts;
create policy "own_acc_update" on public.accounts
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- credit_cards
-- ---------------------------------------------------------------------------
drop policy if exists "own_cc_select" on public.credit_cards;
create policy "own_cc_select" on public.credit_cards
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own_cc_update" on public.credit_cards;
create policy "own_cc_update" on public.credit_cards
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- unparsed_messages: RLS bật nhưng KHÔNG policy nào -> chỉ service_role đọc được.
-- Cố ý: bảng chứa raw SMS chưa lọc, chỉ dùng để debug parser.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Thu hồi GRANT ALL cho anon (schema gốc cấp quá rộng).
-- anon chỉ cần quyền để đăng nhập; mọi truy cập data đều qua role authenticated.
-- ---------------------------------------------------------------------------
revoke all on public.transactions      from anon;
revoke all on public.accounts          from anon;
revoke all on public.credit_cards      from anon;
revoke all on public.unparsed_messages from anon;

grant select, insert, update, delete on public.transactions to authenticated;
grant select, update                 on public.accounts     to authenticated;
grant select, update                 on public.credit_cards to authenticated;
