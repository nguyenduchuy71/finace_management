-- Hộp tin chưa phân loại + loại dòng tiền của giao dịch + CRUD tài khoản ngân hàng.
-- Kế hoạch: plans/261021-0940-unparsed-inbox-bank-tab/

-- ---------------------------------------------------------------------------
-- 1. transactions.kind — loại dòng tiền
--
-- internal_transfer: chuyển giữa TK/thẻ của chính user (gồm trả nợ thẻ). Cả hai
-- chiều đều được ghi, nên nếu tính vào thu/chi thì dashboard đếm gấp đôi.
-- cashback: tiền hoàn ngân hàng trả về — vẫn là thu, tách riêng để đối chiếu.
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists kind text not null default 'normal'
  check (kind in ('normal', 'internal_transfer', 'cashback'));

-- ---------------------------------------------------------------------------
-- 2. get_dashboard_stats: loại internal_transfer khỏi mọi tổng thu/chi
--
-- Lọc ngay trong CTE `filtered` để mọi số (tổng, theo nguồn, theo category,
-- số giao dịch) cùng nhất quán. Giữ NGUYÊN security invoker, search_path và
-- hình dạng JSON (DashboardStatsSchema).
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
      and kind <> 'internal_transfer'
  ),
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

-- ---------------------------------------------------------------------------
-- 3. unparsed_messages: thuộc về user, có nhãn, user đọc/xử lý được
--
-- Trước đây chỉ service_role đọc (bảng debug parser). Nay là "hộp tin chưa phân
-- loại" trên UI nên cần user_id + RLS chính chủ.
-- ---------------------------------------------------------------------------
alter table public.unparsed_messages
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  -- Gợi ý của máy lúc nạp (edge function). NULL = tin cũ chưa backfill.
  add column if not exists suggested_kind text
    check (suggested_kind in ('transaction', 'card_reminder', 'promo', 'unknown')),
  -- Quyết định của user khi xử lý. NULL = chưa xử lý.
  add column if not exists kind text
    check (kind in ('normal', 'internal_transfer', 'cashback', 'card_reminder', 'promo')),
  add column if not exists transaction_id uuid
    references public.transactions(id) on delete set null;

-- Backfill user_id cho tin cũ: app hiện chỉ có MỘT chủ (edge function ghi mọi giao
-- dịch vào DEFAULT_USER_ID). Không đoán khi có nhiều user — dừng migration.
do $$
declare
  v_owners uuid[];
begin
  if exists (select 1 from public.unparsed_messages where user_id is null) then
    select array_agg(distinct user_id) into v_owners from public.credit_cards;
    if coalesce(array_length(v_owners, 1), 0) <> 1 then
      raise exception 'unparsed_messages backfill: cần đúng 1 chủ thẻ, thấy %', v_owners;
    end if;
    update public.unparsed_messages set user_id = v_owners[1] where user_id is null;
  end if;
end;
$$;

alter table public.unparsed_messages alter column user_id set not null;

create index if not exists idx_unparsed_user_open
  on public.unparsed_messages (user_id, resolved, received_at desc);

-- RLS đã bật từ trước (không policy). Chỉ select + update; insert do edge function
-- (service_role), không có delete — tin đã xử lý giữ lại làm lịch sử/mẫu parser.
drop policy if exists "own_unparsed_select" on public.unparsed_messages;
create policy "own_unparsed_select" on public.unparsed_messages
  for select to authenticated using (auth.uid() = user_id);

-- transaction_id phải là giao dịch của chính user (FK một mình cho phép trỏ sang
-- giao dịch của người khác). Subquery chạy dưới RLS của transactions.
drop policy if exists "own_unparsed_update" on public.unparsed_messages;
create policy "own_unparsed_update" on public.unparsed_messages
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (transaction_id is null or exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid()))
  );

-- Grant theo cột: user không sửa được raw_text/user_id/received_at.
revoke all on public.unparsed_messages from anon, authenticated;
grant select on public.unparsed_messages to authenticated;
grant update (resolved, kind, transaction_id) on public.unparsed_messages to authenticated;

-- Tin đã xử lý là BẤT BIẾN. Grant update ở trên (cần cho resolve_unparsed vì RPC
-- là invoker) cũng cho client UPDATE thẳng: bỏ resolved rồi resolve lại sẽ tạo giao
-- dịch thứ hai cho cùng một tin -> dashboard đếm gấp đôi.
create or replace function public.guard_unparsed_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.resolved and (new.resolved is distinct from old.resolved
     or new.kind is distinct from old.kind
     or new.transaction_id is distinct from old.transaction_id) then
    -- Ngoại lệ duy nhất: FK `on delete set null` khi giao dịch liên kết bị xoá.
    if not (new.transaction_id is null and old.transaction_id is not null
            and new.resolved = old.resolved and new.kind is not distinct from old.kind) then
      raise exception 'unparsed message already resolved' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_unparsed_update on public.unparsed_messages;
create trigger trg_guard_unparsed_update
  before update on public.unparsed_messages
  for each row execute function public.guard_unparsed_update();

-- Một giao dịch chỉ gắn với một tin. Cũng là index cho FK (xoá TK/thẻ hàng loạt
-- kích hoạt `on delete set null` trên cột này).
create unique index if not exists uq_unparsed_transaction
  on public.unparsed_messages (transaction_id) where transaction_id is not null;

-- ---------------------------------------------------------------------------
-- 4. accounts: cho phép user thêm / xoá tài khoản của chính mình
--
-- Giống credit_cards (migration 20261018140000). Edge function resolve TK bằng
-- (bank_name, account_number LIKE '%account_ref') -> ép một định dạng mask duy
-- nhất, cùng pattern với CARD_NUMBER_PATTERN của form ('****x265' hợp lệ).
-- ---------------------------------------------------------------------------
alter table public.accounts
  alter column user_id set default auth.uid();

alter table public.accounts
  drop constraint if exists accounts_user_bank_number_key;
alter table public.accounts
  add constraint accounts_user_bank_number_key
  unique (user_id, bank_name, account_number);

alter table public.accounts
  drop constraint if exists accounts_account_number_mask_check;
alter table public.accounts
  add constraint accounts_account_number_mask_check
  check (account_number ~ '^\*{4}[^\s*]{4}$') not valid;
-- Tách validate để lỗi chỉ rõ dữ liệu cũ sai định dạng (nếu có).
alter table public.accounts validate constraint accounts_account_number_mask_check;

drop policy if exists "own_acc_insert" on public.accounts;
create policy "own_acc_insert" on public.accounts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own_acc_delete" on public.accounts;
create policy "own_acc_delete" on public.accounts
  for delete to authenticated using (auth.uid() = user_id);

grant insert, delete on public.accounts to authenticated;

-- ---------------------------------------------------------------------------
-- 5. delete_bank_account — xoá TK KÈM toàn bộ giao dịch, nguyên tử
--
-- Cùng lý do với delete_credit_card: FK account_id là `on delete set null`, xoá
-- trần để lại giao dịch mồ côi. security INVOKER — KHÔNG đổi sang definer.
-- ---------------------------------------------------------------------------
create or replace function public.delete_bank_account(p_account_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted integer;
begin
  perform 1 from public.accounts where id = p_account_id for update;
  if not found then
    raise exception 'bank account not found' using errcode = 'P0002';
  end if;

  delete from public.transactions where account_id = p_account_id;
  get diagnostics v_deleted = row_count;

  delete from public.accounts where id = p_account_id;

  return v_deleted;
end;
$$;

revoke all on function public.delete_bank_account(uuid) from public, anon;
grant execute on function public.delete_bank_account(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. resolve_unparsed — user xử lý một tin chưa phân loại, nguyên tử
--
-- p_kind normal | internal_transfer | cashback -> bắt buộc p_tx, tạo giao dịch:
--   p_tx = { amount (≠0, VND, dương=thu), transaction_date, description?,
--            merchant_name?, category?, account_id | card_id (đúng một) }
--   bank_name/source_type lấy từ TK/thẻ (không tin client). raw_text = nguyên văn tin.
-- p_kind card_reminder | promo -> p_tx phải NULL, chỉ gắn nhãn.
-- Trả id giao dịch (hoặc NULL). Lỗi: P0002 tin/TK/thẻ không thấy (kể cả của
-- người khác — RLS lọc), 22023 tham số sai hoặc tin đã xử lý.
-- security INVOKER: RLS insert transactions kiểm TK/thẻ thuộc user.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_unparsed(
  p_msg_id uuid,
  p_kind   text,
  p_tx     jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  c_uuid       constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_msg        public.unparsed_messages%rowtype;
  v_tx_id      uuid;
  v_account_id uuid;
  v_card_id    uuid;
  v_amount     bigint;
  v_date       timestamptz;
  v_category   text;
  v_bank       text;
  v_source     text;
begin
  select * into v_msg from public.unparsed_messages where id = p_msg_id for update;
  if not found then
    raise exception 'unparsed message not found' using errcode = 'P0002';
  end if;
  if v_msg.resolved then
    raise exception 'unparsed message already resolved' using errcode = '22023';
  end if;

  if p_kind in ('normal', 'internal_transfer', 'cashback') then
    if p_tx is null then
      raise exception 'p_tx required for kind %', p_kind using errcode = '22023';
    end if;
    -- Kiểm định dạng TRƯỚC khi cast: cast sai ném 22P02/22003/22007, lệch hợp đồng
    -- lỗi 22023 mà service map thành thông báo cho user.
    if coalesce(p_tx->>'account_id', '') !~ ('(' || c_uuid || ')|^$')
       or coalesce(p_tx->>'card_id', '') !~ ('(' || c_uuid || ')|^$') then
      raise exception 'invalid account_id / card_id' using errcode = '22023';
    end if;
    v_account_id := nullif(p_tx->>'account_id', '')::uuid;
    v_card_id    := nullif(p_tx->>'card_id', '')::uuid;
    if (v_account_id is null) = (v_card_id is null) then
      raise exception 'exactly one of account_id / card_id required' using errcode = '22023';
    end if;

    -- Số nguyên VND, tối đa 15 chữ số (đủ xa giới hạn bigint).
    if coalesce(p_tx->>'amount', '') !~ '^-?[0-9]{1,15}$' then
      raise exception 'amount must be an integer' using errcode = '22023';
    end if;
    v_amount := (p_tx->>'amount')::bigint;
    if v_amount = 0 then
      raise exception 'amount must be non-zero' using errcode = '22023';
    end if;

    -- Bắt buộc có múi giờ: không có thì Postgres hiểu theo timezone session (UTC
    -- trên Supabase) -> lệch 7 tiếng, có thể sang ngày khác.
    if coalesce(p_tx->>'transaction_date', '')
       !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$' then
      raise exception 'transaction_date must be ISO-8601 with offset' using errcode = '22023';
    end if;
    begin
      v_date := (p_tx->>'transaction_date')::timestamptz;
    exception when others then
      raise exception 'invalid transaction_date' using errcode = '22023';
    end;

    -- Cùng tập Category của frontend (src/types/categories.ts); NULL = tự phân loại.
    v_category := nullif(trim(p_tx->>'category'), '');
    if v_category is not null
       and v_category not in ('Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Hóa đơn', 'Khác') then
      raise exception 'invalid category' using errcode = '22023';
    end if;

    if v_account_id is not null then
      select bank_name into v_bank from public.accounts where id = v_account_id;
      v_source := 'bank';
    else
      select bank_name into v_bank from public.credit_cards where id = v_card_id;
      v_source := 'credit_card';
    end if;
    if v_bank is null then
      raise exception 'account or card not found' using errcode = 'P0002';
    end if;

    insert into public.transactions (
      user_id, bank_name, amount, transaction_date, description, merchant_name,
      category, raw_text, source_type, account_id, card_id, kind, status
    ) values (
      auth.uid(), v_bank, v_amount, v_date,
      nullif(trim(p_tx->>'description'), ''), nullif(trim(p_tx->>'merchant_name'), ''),
      v_category, v_msg.raw_text, v_source,
      v_account_id, v_card_id, p_kind, 'posted'
    )
    returning id into v_tx_id;
  elsif p_kind in ('card_reminder', 'promo') then
    if p_tx is not null then
      raise exception 'p_tx not allowed for kind %', p_kind using errcode = '22023';
    end if;
  else
    raise exception 'invalid kind %', p_kind using errcode = '22023';
  end if;

  update public.unparsed_messages
     set resolved = true, kind = p_kind, transaction_id = v_tx_id
   where id = p_msg_id;

  return v_tx_id;
end;
$$;

revoke all on function public.resolve_unparsed(uuid, text, jsonb) from public, anon;
grant execute on function public.resolve_unparsed(uuid, text, jsonb) to authenticated;
