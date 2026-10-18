-- CRUD thẻ tín dụng + MCC trên giao dịch + rule hoàn tiền theo thẻ.
-- Kế hoạch: plans/261018-1332-card-crud-mcc-cashback/

-- ---------------------------------------------------------------------------
-- 1. credit_cards: cho phép user thêm / xoá thẻ của chính mình
--
-- Trước đây chỉ có select + update (thẻ do seed/service_role tạo). `user_id` có
-- default auth.uid() để client không phải (và không được tin) tự gửi user_id.
-- ---------------------------------------------------------------------------
alter table public.credit_cards
  alter column user_id set default auth.uid();

drop policy if exists "own_cc_insert" on public.credit_cards;
create policy "own_cc_insert" on public.credit_cards
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own_cc_delete" on public.credit_cards;
create policy "own_cc_delete" on public.credit_cards
  for delete to authenticated using (auth.uid() = user_id);

grant insert, delete on public.credit_cards to authenticated;

-- Edge function resolve thẻ bằng (bank_name, card_number LIKE '%account_ref').
-- Chỉ chặn được trùng CHÍNH XÁC; hai định dạng khác nhau cùng đuôi
-- ('****5678' và '5678') vẫn khớp cùng một LIKE -> form thẻ (phase 2) phải
-- ép đúng một định dạng mask.
alter table public.credit_cards
  drop constraint if exists credit_cards_user_bank_number_key;
alter table public.credit_cards
  add constraint credit_cards_user_bank_number_key
  unique (user_id, bank_name, card_number);

-- ---------------------------------------------------------------------------
-- 2. transactions.mcc — user gán tay (SMS ngân hàng VN không kèm MCC)
-- NULL = chưa phân loại. Check không chặn NULL.
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists mcc text
  check (mcc ~ '^[0-9]{4}$');

-- ---------------------------------------------------------------------------
-- 3. card_cashback_rules — rule hoàn tiền theo từng thẻ
--
-- mcc NULL = rule mặc định cho mọi giao dịch không khớp rule MCC nào.
-- min_cycle_spend / cap_per_cycle áp dụng RIÊNG cho từng rule, theo kỳ sao kê.
-- Số tiền hoàn KHÔNG lưu — tính khi đọc từ giao dịch + rule (client).
-- ---------------------------------------------------------------------------
create table if not exists public.card_cashback_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                  references auth.users(id) on delete cascade,
  card_id         uuid not null
                  references public.credit_cards(id) on delete cascade,
  mcc             text check (mcc ~ '^[0-9]{4}$'),
  rate_percent    numeric(5,2) not null check (rate_percent between 0 and 100),
  min_cycle_spend bigint not null default 0 check (min_cycle_spend >= 0),
  cap_per_cycle   bigint check (cap_per_cycle > 0),
  created_at      timestamptz not null default now(),
  -- NULLS NOT DISTINCT: mỗi thẻ chỉ có đúng 1 rule mặc định (mcc NULL).
  constraint card_cashback_rules_card_mcc_key
    unique nulls not distinct (card_id, mcc)
);

-- Không cần index riêng cho card_id: unique (card_id, mcc) đã dẫn đầu bằng card_id.

alter table public.card_cashback_rules enable row level security;

-- `card_id` phải là thẻ của chính user: FK một mình cho phép user A gắn rule
-- vào thẻ của user B (với user_id = A vẫn qua `auth.uid() = user_id`).
-- Subquery chạy dưới RLS của credit_cards nên chỉ thấy thẻ của mình.
drop policy if exists "own_rule_select" on public.card_cashback_rules;
create policy "own_rule_select" on public.card_cashback_rules
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own_rule_insert" on public.card_cashback_rules;
create policy "own_rule_insert" on public.card_cashback_rules
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.credit_cards c
      where c.id = card_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "own_rule_update" on public.card_cashback_rules;
create policy "own_rule_update" on public.card_cashback_rules
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.credit_cards c
      where c.id = card_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "own_rule_delete" on public.card_cashback_rules;
create policy "own_rule_delete" on public.card_cashback_rules
  for delete to authenticated using (auth.uid() = user_id);

-- Thu hết default privileges (có thể gồm truncate/references/trigger) rồi cấp lại đúng 4 quyền.
revoke all on public.card_cashback_rules from anon, authenticated;
grant select, insert, update, delete on public.card_cashback_rules to authenticated;

-- ---------------------------------------------------------------------------
-- 3b. transactions: card_id / account_id phải thuộc chính user
--
-- Policy cũ chỉ kiểm `auth.uid() = user_id`, nên user A chèn/sửa được giao dịch
-- trỏ vào thẻ của user B (FK vẫn chấp nhận). Khi B xoá thẻ, `on delete set null`
-- biến giao dịch của A thành mồ côi: ẩn khỏi danh sách nhưng dashboard vẫn đếm.
-- Edge function dùng service_role (bypass RLS) nên không bị ảnh hưởng.
-- ---------------------------------------------------------------------------
drop policy if exists "own_tx_insert" on public.transactions;
create policy "own_tx_insert" on public.transactions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (card_id is null or exists (
      select 1 from public.credit_cards c where c.id = card_id and c.user_id = auth.uid()))
    and (account_id is null or exists (
      select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
  );

drop policy if exists "own_tx_update" on public.transactions;
create policy "own_tx_update" on public.transactions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (card_id is null or exists (
      select 1 from public.credit_cards c where c.id = card_id and c.user_id = auth.uid()))
    and (account_id is null or exists (
      select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 4. delete_credit_card — xoá thẻ KÈM toàn bộ giao dịch, nguyên tử
--
-- FK transactions.card_id là `on delete set null`: xoá thẻ trần sẽ để lại giao
-- dịch mồ côi (ẩn khỏi danh sách nhưng vẫn được dashboard đếm). Hàm này xoá
-- giao dịch trước, rồi thẻ, trong cùng một transaction.
--
-- security INVOKER: RLS vẫn áp dụng — thẻ của người khác thì cả 2 lệnh xoá
-- đều 0 dòng và hàm raise lỗi (không thành công im lặng). KHÔNG đổi sang definer.
-- Trả về số giao dịch đã xoá.
-- ---------------------------------------------------------------------------
create or replace function public.delete_credit_card(p_card_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted integer;
begin
  -- Khoá dòng thẻ trước: một insert đồng thời của edge function (FK lấy key share
  -- trên thẻ) phải chờ tới khi xoá xong rồi lỗi FK, thay vì chèn lọt giữa hai lệnh
  -- xoá rồi bị set null thành giao dịch mồ côi. RLS lọc thẻ người khác -> not found.
  perform 1 from public.credit_cards where id = p_card_id for update;
  if not found then
    raise exception 'credit card not found' using errcode = 'P0002';
  end if;

  delete from public.transactions where card_id = p_card_id;
  get diagnostics v_deleted = row_count;

  delete from public.credit_cards where id = p_card_id;

  return v_deleted;
end;
$$;

revoke all on function public.delete_credit_card(uuid) from public, anon;
grant execute on function public.delete_credit_card(uuid) to authenticated;
