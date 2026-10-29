-- Nạp credit qua MoMo / ZaloPay: gói, đơn, sự kiện cổng thanh toán, RPC cộng credit idempotent.
-- Kế hoạch: plans/261027-1012-saas-signup-api-key-credits/ (phase 3)
--
-- Chỉ `fulfill_order` (service_role, gọi từ edge function IPN/đối soát) mới cộng credit; trang redirect không bao giờ cộng.
-- Không sửa hàm phase 2: dùng lại `_apply_credit`, `_ensure_credit_account`, `replay_held_messages` như đã có.

-- ---------------------------------------------------------------------------
-- 1. Bảng
-- ---------------------------------------------------------------------------
create table if not exists public.credit_packages (
  id        text primary key,
  credits   int    not null check (credits > 0),
  price_vnd bigint not null check (price_vnd between 1000 and 50000000),
  active    boolean not null default true,
  sort      int    not null default 0
);
-- Sửa bằng SQL (không deploy). on conflict do nothing: chạy lại migration không ghi đè giá đã chỉnh.
insert into public.credit_packages (id, credits, price_vnd, sort) values
  ('p50k', 500, 50000, 1), ('p100k', 1200, 100000, 2), ('p200k', 3000, 200000, 3)
on conflict (id) do nothing;

create table if not exists public.payment_orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  provider           text not null check (provider in ('momo', 'zalopay')),
  -- 'yymmdd_' (GMT+7) + 12 ký tự [a-z0-9]: MoMo orderId/requestId, ZaloPay app_trans_id (≤ 40 ký tự)
  provider_order_ref text not null unique,
  provider_tx_id     text,                       -- MoMo transId / ZaloPay zp_trans_id
  package_id         text not null references public.credit_packages(id),
  amount_vnd         bigint not null check (amount_vnd > 0),   -- chụp từ gói lúc tạo, KHÔNG tin số trong payload
  credits            int    not null check (credits > 0),
  status             text not null default 'pending'
                       check (status in ('pending', 'paid', 'expired', 'failed', 'mismatch')),
  pay_url            text,
  paid_at            timestamptz,
  last_checked_at    timestamptz,
  expires_at         timestamptz not null default now() + interval '15 minutes',
  created_at         timestamptz not null default now(),
  unique (provider, provider_tx_id)              -- NULL không đụng nhau; đây là khoá idempotency của IPN
);
create index if not exists payment_orders_user_idx on public.payment_orders (user_id, created_at desc);
create index if not exists payment_orders_pending_idx on public.payment_orders (created_at) where status = 'pending';

-- Log mọi create/IPN/query để đối soát. payload KHÔNG chứa key/chữ ký (edge function lọc trước khi ghi).
create table if not exists public.payment_events (
  id             bigint generated always as identity primary key,
  provider       text not null,
  order_ref      text,
  provider_tx_id text,
  source         text not null check (source in ('create', 'ipn', 'query')),
  result         text not null,
  payload        jsonb not null,
  received_at    timestamptz not null default now()
);

alter table public.credit_packages enable row level security;
alter table public.payment_orders  enable row level security;
alter table public.payment_events  enable row level security;

drop policy if exists credit_packages_select on public.credit_packages;
create policy credit_packages_select on public.credit_packages for select to authenticated using (active);
drop policy if exists payment_orders_select_own on public.payment_orders;
create policy payment_orders_select_own on public.payment_orders for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists not_suspended on public.payment_orders;
create policy not_suspended on public.payment_orders as restrictive for all to authenticated
  using (not (select public.is_suspended())) with check (not (select public.is_suspended()));

revoke all on public.credit_packages, public.payment_orders, public.payment_events from public, anon, authenticated;
grant select on public.credit_packages, public.payment_orders to authenticated;   -- ghi: chỉ qua RPC service_role
grant select on public.credit_packages, public.payment_orders to service_role;
grant select on public.payment_events to service_role;

-- ---------------------------------------------------------------------------
-- 2. RPC (security invoker; chỉ service_role)
-- ---------------------------------------------------------------------------
-- Tạo đơn: gói còn bán, user không bị khoá (user lạ -> FK 23503), ≤ 5 đơn pending chưa hết hạn (22023).
-- advisory lock theo user để 2 request song song không cùng vượt giới hạn.
create or replace function public.create_payment_order(p_user uuid, p_provider text, p_package_id text)
returns public.payment_orders
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_pkg public.credit_packages;
  v_row public.payment_orders;
  v_ref text;
begin
  if p_provider not in ('momo', 'zalopay') then
    raise exception 'provider không hợp lệ' using errcode = '22023';
  end if;
  select * into v_pkg from public.credit_packages where id = p_package_id and active;
  if not found then
    raise exception 'gói không tồn tại hoặc đã ngừng bán' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.user_settings where user_id = p_user and suspended_at is not null) then
    raise exception 'tài khoản bị khoá' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('payment_orders:' || p_user::text, 0));
  if (select count(*) from public.payment_orders
       where user_id = p_user and status = 'pending' and expires_at > now()) >= 5 then
    raise exception 'quá nhiều đơn đang chờ thanh toán' using errcode = '22023';
  end if;

  v_ref := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || '_'
        || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.payment_orders (user_id, provider, provider_order_ref, package_id, amount_vnd, credits)
  values (p_user, p_provider, v_ref, v_pkg.id, v_pkg.price_vnd, v_pkg.credits)
  returning * into v_row;
  return v_row;
end;
$$;

-- Đơn của đúng user (cho edge function refresh): không có -> không trả dòng.
create or replace function public.get_payment_order(p_order uuid, p_user uuid)
returns setof public.payment_orders
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.payment_orders where id = p_order and user_id = p_user;
$$;

create or replace function public.set_order_pay_url(p_order uuid, p_pay_url text)
returns boolean
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  update public.payment_orders set pay_url = p_pay_url where id = p_order and status = 'pending';
  return found;
end;
$$;

-- Chỉ đơn đang pending mới chuyển 'failed' (provider từ chối lúc tạo / IPN báo thất bại / query báo thất bại).
create or replace function public.fail_payment_order(p_provider text, p_order_ref text, p_reason text)
returns boolean
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  update public.payment_orders set status = 'failed'
   where provider = p_provider and provider_order_ref = p_order_ref and status = 'pending';
  return found;
end;
$$;

create or replace function public.mark_order_checked(p_order uuid)
returns void
language sql
volatile
security invoker
set search_path = public
as $$
  update public.payment_orders set last_checked_at = now() where id = p_order;
$$;

create or replace function public.log_payment_event(
  p_provider text, p_order_ref text, p_tx_id text, p_source text, p_result text, p_payload jsonb
) returns void
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.payment_events (provider, order_ref, provider_tx_id, source, result, payload)
  values (p_provider, p_order_ref, p_tx_id, p_source, p_result, coalesce(p_payload, '{}'::jsonb));
$$;

-- Đơn pending cần đối soát: đã tạo quá p_min_age_s giây (IPN bình thường tới trước đó).
create or replace function public.list_orders_to_reconcile(p_min_age_s int, p_limit int)
returns setof public.payment_orders
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.payment_orders
   where status = 'pending' and created_at < now() - make_interval(secs => p_min_age_s)
   order by created_at
   limit greatest(p_limit, 0);
$$;

-- Cộng credit cho đơn đã thanh toán. Trả: 'paid' | 'duplicate' | 'mismatch' | 'unknown_order'.
--   * (provider, provider_tx_id) đã gặp -> 'duplicate' (IPN lặp / 2 IPN song song: khoá dòng đơn rồi kiểm lại).
--   * số tiền lệch / quá hạn / đơn không còn pending -> KHÔNG cộng; đơn pending chuyển 'mismatch' (admin xử lý).
--     Đơn ĐÃ 'paid' mà tới tx_id khác (trả 2 lần) -> trả 'mismatch' nhưng GIỮ nguyên 'paid' của đơn.
--   * ngược lại: paid + cộng credit đúng 1 lần (ref = order.id) + phát lại tin treo `no_credit`, cùng 1 transaction
--     (replay lỗi chỉ bị bỏ qua + cảnh báo, không rollback credit).
create or replace function public.fulfill_order(
  p_provider text, p_order_ref text, p_provider_tx_id text, p_amount bigint
) returns text
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  o public.payment_orders;
begin
  if p_provider_tx_id is null or p_provider_tx_id = '' then
    raise exception 'thiếu mã giao dịch của provider' using errcode = '22023';
  end if;
  if exists (select 1 from public.payment_orders where provider = p_provider and provider_tx_id = p_provider_tx_id) then
    return 'duplicate';
  end if;

  select * into o from public.payment_orders
   where provider = p_provider and provider_order_ref = p_order_ref for update;
  if not found then
    return 'unknown_order';
  end if;
  -- Phiên song song đã xử lý cùng tx_id trong lúc ta chờ khoá.
  if o.provider_tx_id = p_provider_tx_id then
    return 'duplicate';
  end if;

  if o.status = 'paid' then
    return 'mismatch';
  end if;
  if o.status <> 'pending' or now() > o.expires_at or p_amount is distinct from o.amount_vnd then
    update public.payment_orders
       set status = 'mismatch', provider_tx_id = coalesce(provider_tx_id, p_provider_tx_id)
     where id = o.id;
    return 'mismatch';
  end if;

  update public.payment_orders
     set status = 'paid', paid_at = now(), provider_tx_id = p_provider_tx_id
   where id = o.id;
  perform public._ensure_credit_account(o.user_id);
  perform public._apply_credit(o.user_id, o.credits, 'purchase', o.id::text);
  -- Phát lại tin treo là việc PHỤ: tin hỏng (replay ném lỗi ngoài P0002/23503) không được làm rollback credit đã trả tiền.
  -- Savepoint của khối EXCEPTION hoàn tác riêng phần replay; tin còn treo sẽ được phát lại ở lần nạp / replay sau.
  begin
    perform public.replay_held_messages(o.user_id);
  exception when others then
    raise warning 'replay_held_messages lỗi sau khi nạp (user %): % %', o.user_id, sqlstate, sqlerrm;
  end;
  return 'paid';
end;
$$;

-- Đơn pending đã quá hạn VÀ đã được hỏi provider sau hạn (không còn khả năng thanh toán bị bỏ sót) -> 'expired'.
create or replace function public.expire_stale_orders()
returns int
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare v int;
begin
  update public.payment_orders set status = 'expired'
   where status = 'pending' and expires_at < now() and last_checked_at is not null and last_checked_at > expires_at;
  get diagnostics v = row_count;
  return v;
end;
$$;

-- Quyền ghi: security invoker chạy dưới service_role nên cần grant bảng tường minh.
grant select, insert, update on public.payment_orders to service_role;
grant insert on public.payment_events to service_role;
grant select on public.user_settings to service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'create_payment_order(uuid, text, text)', 'get_payment_order(uuid, uuid)', 'set_order_pay_url(uuid, text)',
    'fail_payment_order(text, text, text)', 'mark_order_checked(uuid)',
    'log_payment_event(text, text, text, text, text, jsonb)', 'list_orders_to_reconcile(int, int)',
    'fulfill_order(text, text, text, bigint)', 'expire_stale_orders()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
