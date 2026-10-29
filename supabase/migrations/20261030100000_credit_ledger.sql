-- Credit trả trước: sổ cái, số dư, ingest nguyên tử, giữ tin `no_credit` + replay.
-- Kế hoạch: plans/261027-1012-saas-signup-api-key-credits/ (phase 2)
--
-- Mỗi giao dịch GHI THÀNH CÔNG bởi parser (API key / x-shortcut-secret) trừ 1 credit. Insert + trừ credit
-- phải nguyên tử nên chuyển vào RPC `ingest_transaction` (không làm được từ client supabase-js).
-- Mọi hàm ghi credit CHỈ service_role; user chỉ ĐỌC số dư + sổ cái của mình.
-- Thứ tự deploy: db push rồi deploy parse-transaction + admin ngay (function cũ insert thẳng, không trừ credit).

-- ---------------------------------------------------------------------------
-- 1. Bảng
-- ---------------------------------------------------------------------------
-- Sổ cái append-only. unique (kind, ref) = idempotency: cùng giao dịch / đơn / dòng audit chỉ áp 1 lần.
create table if not exists public.credit_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  delta      int  not null check (delta <> 0),
  kind       text not null check (kind in ('grant', 'purchase', 'usage', 'refund', 'adjust')),
  ref        text not null,
  created_at timestamptz not null default now(),
  unique (kind, ref)
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc, id desc);

-- Số dư là cache của sum(delta), cập nhật CÙNG transaction với dòng sổ cái. CHECK >= 0 chặn âm ở DB.
-- unlimited: chủ app không bị trừ / không bị giữ tin. CHỈ đặt bằng SQL (không role client nào có grant ghi):
--   update credit_balances set unlimited = true where user_id = '<uuid>';
create table if not exists public.credit_balances (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    int not null default 0 check (balance >= 0),
  unlimited  boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 1 dòng, chỉnh bằng SQL không cần deploy. RLS bật, không policy, không grant client.
create table if not exists public.credit_settings (
  id              boolean primary key default true check (id),
  welcome_credits int not null check (welcome_credits >= 0)
);
insert into public.credit_settings (id, welcome_credits) values (true, 100) on conflict (id) do nothing;

alter table public.credit_ledger   enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_settings enable row level security;

create policy credit_ledger_select_own on public.credit_ledger
  for select to authenticated using (auth.uid() = user_id);
create policy credit_balances_select_own on public.credit_balances
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.credit_ledger, public.credit_balances, public.credit_settings from public, anon, authenticated;
grant select on public.credit_ledger, public.credit_balances to authenticated;
grant select, insert on public.credit_ledger to service_role;
grant select, insert, update on public.credit_balances to service_role;
grant select on public.credit_settings to service_role;
-- Các hàm dưới là security invoker chạy dưới service_role: ghi rõ quyền thay vì dựa vào mặc định Supabase.
grant select on public.accounts, public.credit_cards to service_role;
grant insert on public.transactions to service_role;
grant select, insert, update on public.unparsed_messages to service_role;

-- Khoá có hiệu lực ngay cả với access token còn hạn (xem 20261028100000): thêm 2 bảng mới vào danh sách.
do $$
declare t text;
begin
  foreach t in array array['credit_ledger', 'credit_balances'] loop
    execute format('drop policy if exists not_suspended on public.%I', t);
    execute format(
      'create policy not_suspended on public.%I as restrictive for all to authenticated
         using (not (select public.is_suspended())) with check (not (select public.is_suspended()))', t);
  end loop;
end $$;

-- Append-only: UPDATE bị chặn kể cả service_role. DELETE chỉ xảy ra qua cascade khi xoá user (không trigger).
create or replace function public.credit_ledger_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'credit_ledger là append-only' using errcode = '42501';
end;
$$;
revoke all on function public.credit_ledger_immutable() from public, anon, authenticated;
grant execute on function public.credit_ledger_immutable() to service_role;

drop trigger if exists credit_ledger_immutable on public.credit_ledger;
create trigger credit_ledger_immutable
  before update on public.credit_ledger
  for each row execute function public.credit_ledger_immutable();
drop trigger if exists credit_ledger_no_truncate on public.credit_ledger;
create trigger credit_ledger_no_truncate
  before truncate on public.credit_ledger
  for each statement execute function public.credit_ledger_immutable();

-- Tin giữ vì hết credit: giữ nguyên tx + refs đã resolve để replay không phải parse lại.
alter table public.unparsed_messages add column if not exists parsed_payload jsonb;

-- ---------------------------------------------------------------------------
-- 2. Hàm nội bộ (private) — chỉ service_role
-- ---------------------------------------------------------------------------
-- Áp 1 dòng sổ cái + cập nhật số dư. false = ref này đã áp rồi (idempotent, KHÔNG cộng lần 2).
-- Số dư âm -> CHECK ném 23514, rollback cả dòng sổ cái. Hàng số dư phải tồn tại.
create or replace function public._apply_credit(p_user uuid, p_delta int, p_kind text, p_ref text)
returns boolean
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  insert into public.credit_ledger (user_id, delta, kind, ref)
  values (p_user, p_delta, p_kind, p_ref)
  on conflict (kind, ref) do nothing;
  if not found then
    return false;
  end if;

  update public.credit_balances
     set balance = balance + p_delta, updated_at = now()
   where user_id = p_user;
  if not found then
    raise exception 'user chưa có ví credit' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

-- Tạo ví + credit chào mừng cho user (idempotent: ví đã có / đã tặng thì không làm lại).
-- Dùng cho trigger đăng ký, backfill, và tự chữa trong ingest khi thiếu hàng số dư.
create or replace function public._ensure_credit_account(p_user uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_welcome int;
begin
  insert into public.credit_balances (user_id) values (p_user) on conflict (user_id) do nothing;
  select welcome_credits into v_welcome from public.credit_settings;
  -- delta <> 0 nên bỏ qua khi cấu hình tặng 0.
  if coalesce(v_welcome, 0) > 0 then
    perform public._apply_credit(p_user, v_welcome, 'grant', 'welcome:' || p_user);
  end if;
end;
$$;

-- Ghi giao dịch từ payload parser. Ví dụ p_tx: {bank_name, amount, currency, transaction_date, description,
-- raw_text, source_type, account_ref, merchant_name, kind}; p_refs: {account_id} XOR {card_id}.
-- TK/thẻ phải thuộc p_user (service_role bỏ qua RLS nên kiểm ở đây): sai -> P0002.
create or replace function public._insert_parsed_tx(p_user uuid, p_tx jsonb, p_refs jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_account uuid := nullif(p_refs ->> 'account_id', '')::uuid;
  v_card    uuid := nullif(p_refs ->> 'card_id', '')::uuid;
  v_id      uuid;
begin
  if (v_account is null) = (v_card is null) then
    raise exception 'exactly one of account_id / card_id required' using errcode = '22023';
  end if;
  if v_account is not null and not exists (
       select 1 from public.accounts where id = v_account and user_id = p_user) then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
  if v_card is not null and not exists (
       select 1 from public.credit_cards where id = v_card and user_id = p_user) then
    raise exception 'card not found' using errcode = 'P0002';
  end if;

  insert into public.transactions (
    user_id, bank_name, amount, currency, transaction_date, description, raw_text,
    source_type, account_ref, merchant_name, kind, account_id, card_id
  ) values (
    p_user, p_tx ->> 'bank_name', (p_tx ->> 'amount')::bigint, coalesce(p_tx ->> 'currency', 'VND'),
    (p_tx ->> 'transaction_date')::timestamptz, p_tx ->> 'description', p_tx ->> 'raw_text',
    p_tx ->> 'source_type', p_tx ->> 'account_ref', p_tx ->> 'merchant_name',
    coalesce(p_tx ->> 'kind', 'normal'), v_account, v_card
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. ingest_transaction — insert + trừ credit nguyên tử (service_role)
--
-- Khoá hàng số dư (FOR UPDATE) trước: 2 tin đến song song với số dư 1 chạy lần lượt -> đúng 1 ghi + 1 giữ.
-- Trả {status: 'inserted', id} | {status: 'held', id} | {status: 'held_full'} (trần 300 tin treo/user).
-- unlimited: ghi không trừ (không có dòng sổ cái — delta <> 0 nên không ghi dòng 0) và không bao giờ giữ.
-- ---------------------------------------------------------------------------
create or replace function public.ingest_transaction(
  p_user uuid, p_tx jsonb, p_refs jsonb, p_source text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  c_max_held constant int := 300;
  v_balance   int;
  v_unlimited boolean;
  v_id        uuid;
begin
  select balance, unlimited into v_balance, v_unlimited
    from public.credit_balances where user_id = p_user for update;
  if not found then
    perform public._ensure_credit_account(p_user);
    select balance, unlimited into v_balance, v_unlimited
      from public.credit_balances where user_id = p_user for update;
  end if;

  if v_unlimited or v_balance >= 1 then
    v_id := public._insert_parsed_tx(p_user, p_tx, p_refs);
    if not v_unlimited then
      perform public._apply_credit(p_user, -1, 'usage', v_id::text);
    end if;
    return jsonb_build_object('status', 'inserted', 'id', v_id);
  end if;

  -- Đếm trong cùng khoá số dư nên trần không bị vượt khi nhiều tin đến cùng lúc.
  if (select count(*) from public.unparsed_messages
       where user_id = p_user and reason = 'no_credit' and not resolved) >= c_max_held then
    return jsonb_build_object('status', 'held_full');
  end if;

  insert into public.unparsed_messages (user_id, raw_text, source, reason, suggested_kind, parsed_payload)
  values (p_user, p_tx ->> 'raw_text', p_source, 'no_credit', 'transaction',
          jsonb_build_object('tx', p_tx, 'refs', p_refs))
  returning id into v_id;
  return jsonb_build_object('status', 'held', 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. replay_held_messages — ghi các tin treo theo thứ tự đến, tới khi hết credit (service_role)
--
-- Cùng thứ tự khoá với ingest (số dư rồi tới tin). TK/thẻ đã bị xoá trong lúc treo -> đổi reason
-- 'no_account' (user tự xử ở hộp tin, miễn phí), không trừ credit. Trả số giao dịch đã ghi.
-- ---------------------------------------------------------------------------
create or replace function public.replay_held_messages(p_user uuid)
returns int
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_balance   int;
  v_unlimited boolean;
  v_count     int := 0;
  r           record;
  v_id        uuid;
begin
  select balance, unlimited into v_balance, v_unlimited
    from public.credit_balances where user_id = p_user for update;
  if not found then
    perform public._ensure_credit_account(p_user);
    select balance, unlimited into v_balance, v_unlimited
      from public.credit_balances where user_id = p_user for update;
  end if;

  for r in
    select id, parsed_payload from public.unparsed_messages
     where user_id = p_user and reason = 'no_credit' and not resolved
     order by received_at, id
     for update
  loop
    exit when not v_unlimited and v_balance < 1;
    begin
      v_id := public._insert_parsed_tx(p_user, r.parsed_payload -> 'tx', r.parsed_payload -> 'refs');
    exception when sqlstate 'P0002' or sqlstate '23503' then
      update public.unparsed_messages set reason = 'no_account' where id = r.id;
      continue;
    end;
    if not v_unlimited then
      perform public._apply_credit(p_user, -1, 'usage', v_id::text);
      v_balance := v_balance - 1;
    end if;
    update public.unparsed_messages
       set resolved = true, kind = coalesce(r.parsed_payload -> 'tx' ->> 'kind', 'normal'), transaction_id = v_id
     where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Quyền: chỉ service_role (từ migration 20261029100000 không còn EXECUTE mặc định cho PUBLIC/anon)
-- ---------------------------------------------------------------------------
revoke all on function public._apply_credit(uuid, int, text, text)            from public, anon, authenticated;
revoke all on function public._ensure_credit_account(uuid)                    from public, anon, authenticated;
revoke all on function public._insert_parsed_tx(uuid, jsonb, jsonb)           from public, anon, authenticated;
revoke all on function public.ingest_transaction(uuid, jsonb, jsonb, text)    from public, anon, authenticated;
revoke all on function public.replay_held_messages(uuid)                      from public, anon, authenticated;
grant execute on function public._apply_credit(uuid, int, text, text)         to service_role;
grant execute on function public._ensure_credit_account(uuid)                 to service_role;
grant execute on function public._insert_parsed_tx(uuid, jsonb, jsonb)        to service_role;
grant execute on function public.ingest_transaction(uuid, jsonb, jsonb, text) to service_role;
grant execute on function public.replay_held_messages(uuid)                   to service_role;

-- ---------------------------------------------------------------------------
-- 6. Đăng ký: tạo ví + credit chào mừng (đọc credit_settings, không hardcode)
-- handle_new_user vẫn là ngoại lệ security definer duy nhất; _ensure_credit_account chạy dưới chủ function.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text := nullif(new.raw_user_meta_data ->> 'privacy_policy_version', '');
begin
  insert into public.user_settings (user_id, privacy_policy_version, privacy_consent_at)
  values (new.id, v_version, case when v_version is not null then now() end)
  on conflict (user_id) do nothing;
  perform public._ensure_credit_account(new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- User đã có: ví + credit chào mừng để không bị chặn ngay khi deploy (idempotent).
do $$
declare u record;
begin
  for u in select id from auth.users loop
    perform public._ensure_credit_account(u.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. resolve_unparsed: từ chối tin `no_credit`
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
  -- Tin giữ vì hết credit chỉ được replay_held_messages ghi (sau khi nạp). Cho user tự resolve thì
  -- "hết credit" thành "ghi miễn phí": tự phân loại từng tin treo là vượt thanh toán.
  if v_msg.reason = 'no_credit' then
    raise exception 'message held: chờ nạp credit' using errcode = '22023';
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

-- ---------------------------------------------------------------------------
-- 8. Admin: điều chỉnh credit + số dư trong thống kê (chỉ service_role, qua edge function `admin`)
-- ---------------------------------------------------------------------------
alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check
  check (action in ('suspend', 'unsuspend', 'revoke_keys', 'view_user', 'adjust_credit'));

-- Ghi audit rồi áp sổ cái CÙNG transaction: ref 'audit:<id>' gắn dòng sổ cái với dòng audit.
-- Âm quá số dư -> 22003 (kiểm trước; CHECK ở DB là chốt chặn cuối) và rollback cả audit. Trả số dư mới.
create or replace function public.admin_adjust_credit(p_admin uuid, p_user uuid, p_delta int, p_reason text)
returns int
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_balance  int;
  v_audit_id bigint;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'delta phải khác 0' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_settings where user_id = p_user) then
    raise exception 'user không tồn tại' using errcode = 'P0002';
  end if;

  perform public._ensure_credit_account(p_user);
  select balance into v_balance from public.credit_balances where user_id = p_user for update;
  if v_balance + p_delta < 0 then
    raise exception 'số dư không đủ để trừ' using errcode = '22003';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, reason, payload)
  values (p_admin, 'adjust_credit', p_user, btrim(p_reason), jsonb_build_object('delta', p_delta))
  returning id into v_audit_id;

  perform public._apply_credit(p_user, p_delta, 'adjust', 'audit:' || v_audit_id);
  return v_balance + p_delta;
end;
$$;

-- 20 dòng sổ cái gần nhất của 1 user (drawer admin). Chỉ delta/loại/thời điểm — không ref (có thể là id giao dịch).
create or replace function public.admin_user_ledger(p_user uuid, p_limit int default 20)
returns table (id bigint, delta int, kind text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select l.id, l.delta, l.kind, l.created_at
  from public.credit_ledger l
  where l.user_id = p_user
  order by l.created_at desc, l.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- admin_user_stats thêm số dư + cờ unlimited (đổi kiểu trả về -> drop + tạo lại + cấp lại quyền).
drop function if exists public.admin_user_stats(uuid[]);
create function public.admin_user_stats(p_user_ids uuid[] default null)
returns table (
  user_id            uuid,
  suspended_at       timestamptz,
  suspended_reason   text,
  consent_at         timestamptz,
  keys_active        int,
  keys_last_used_at  timestamptz,
  tx_count_30d       int,
  unparsed_30d       jsonb,
  credit_balance     int,
  credit_unlimited   boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.user_id,
    s.suspended_at,
    case when s.suspended_at is not null then
      (select a.reason from public.admin_audit_log a
        where a.target_user_id = s.user_id and a.action = 'suspend'
        order by a.created_at desc, a.id desc limit 1)
    end,
    s.privacy_consent_at,
    (select count(*)::int from public.api_keys k where k.user_id = s.user_id and k.revoked_at is null),
    (select max(k.last_used_at) from public.api_keys k where k.user_id = s.user_id),
    (select count(*)::int from public.transactions t
      where t.user_id = s.user_id and t.created_at >= now() - interval '30 days'
        and not exists (select 1 from public.unparsed_messages m where m.transaction_id = t.id)),
    (select coalesce(jsonb_object_agg(r.reason, r.n), '{}'::jsonb)
       from (select coalesce(u.reason, 'unknown') as reason, count(*)::int as n
               from public.unparsed_messages u
              where u.user_id = s.user_id and u.received_at >= now() - interval '30 days'
              group by 1) r),
    coalesce((select b.balance from public.credit_balances b where b.user_id = s.user_id), 0),
    coalesce((select b.unlimited from public.credit_balances b where b.user_id = s.user_id), false)
  from public.user_settings s
  where p_user_ids is null or s.user_id = any (p_user_ids);
$$;

revoke all on function public.admin_adjust_credit(uuid, uuid, int, text) from public, anon, authenticated;
revoke all on function public.admin_user_ledger(uuid, int)               from public, anon, authenticated;
revoke all on function public.admin_user_stats(uuid[])                   from public, anon, authenticated;
grant execute on function public.admin_adjust_credit(uuid, uuid, int, text) to service_role;
grant execute on function public.admin_user_ledger(uuid, int)               to service_role;
grant execute on function public.admin_user_stats(uuid[])                   to service_role;
grant select on public.credit_balances, public.credit_ledger to service_role;
