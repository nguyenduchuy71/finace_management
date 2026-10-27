-- Quản trị user: khoá/mở khoá, thu hồi key, audit. Kế hoạch: plans/261027-1049-admin-user-management/ (phase 1)
--
-- RLS hiện có KHÔNG đổi: không có policy "admin bypass". Admin chỉ đi qua edge function `admin`
-- (service role), function kiểm role + MFA rồi gọi các RPC dưới đây — CHỈ service_role gọi được.
-- RPC thống kê chỉ trả count()/max(): admin không đọc số tiền, mô tả, raw_text, tên người chuyển.

-- ---------------------------------------------------------------------------
-- 1. Cờ khoá trên user_settings
--
-- Khoá = cờ DB + ban GoTrue (chặn đăng nhập và refresh, function đặt). Cờ DB chặn NGAY:
-- Shortcut (authenticate_api_key) và mọi truy cập dữ liệu kể cả bằng access token còn hạn
-- (policy RESTRICTIVE ở mục 5). User đọc được cờ của mình (grant select cấp bảng) nhưng không
-- sửa được: grant update chỉ có cột owner_names (migration 20261027100000).
-- Lý do khoá KHÔNG nằm ở đây (user đọc được bảng này) mà chỉ trong admin_audit_log.
-- ---------------------------------------------------------------------------
alter table public.user_settings
  add column if not exists suspended_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. admin_audit_log — append-only
--
-- target_user_id KHÔNG có FK: log phải còn sau khi user bị xoá. Không lưu email hay nội
-- dung giao dịch trong payload. reason bắt buộc để mỗi thao tác giải thích được về sau.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id             bigint generated always as identity primary key,
  admin_id       uuid not null,
  action         text not null check (action in ('suspend', 'unsuspend', 'revoke_keys', 'view_user')),
  target_user_id uuid,
  reason         text not null check (length(btrim(reason)) between 5 and 500),
  payload        jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_user_id, created_at desc);

-- Bật RLS không policy = chặn mọi role thường kể cả khi ai đó lỡ grant; service_role bypass RLS.
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant select, insert on public.admin_audit_log to service_role;

create or replace function public.admin_audit_log_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'admin_audit_log là append-only' using errcode = '42501';
end;
$$;

drop trigger if exists admin_audit_log_immutable on public.admin_audit_log;
create trigger admin_audit_log_immutable
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_immutable();
-- Trigger theo dòng không bắt TRUNCATE; hiện không role nào có quyền truncate, chặn thêm phòng khi lỡ grant.
drop trigger if exists admin_audit_log_no_truncate on public.admin_audit_log;
create trigger admin_audit_log_no_truncate
  before truncate on public.admin_audit_log
  for each statement execute function public.admin_audit_log_immutable();

-- service_role trên Supabase có sẵn quyền các bảng này; ghi rõ để không phụ thuộc mặc định
-- (và để test trên Postgres tạm chạy được).
grant select on public.transactions, public.unparsed_messages to service_role;
grant select, update on public.user_settings to service_role;

-- ---------------------------------------------------------------------------
-- 3. authenticate_api_key: thêm cột `suspended`
--
-- Đổi kiểu trả về -> phải drop rồi tạo lại (create or replace không đổi được OUT columns),
-- và cấp lại quyền. Function cũ đang chạy vẫn đọc được kết quả (cột thừa bị bỏ qua) -> thứ tự
-- deploy: db push rồi deploy parse-transaction.
-- ---------------------------------------------------------------------------
drop function if exists public.authenticate_api_key(text);

create function public.authenticate_api_key(p_key_hash text)
returns table (user_id uuid, owner_names text[], rate_limited boolean, suspended boolean)
language sql
volatile
security invoker
set search_path = public
as $$
  with k as (
    update public.api_keys a
    set rl_window_start = case when a.rl_window_start is null
                                 or a.rl_window_start < now() - interval '1 minute'
                               then now() else a.rl_window_start end,
        rl_count        = case when a.rl_window_start is null
                                 or a.rl_window_start < now() - interval '1 minute'
                               then 1 else a.rl_count + 1 end,
        last_used_at    = now()
    where a.key_hash = decode(p_key_hash, 'hex')
      and a.revoked_at is null
    returning a.user_id, a.rl_count
  )
  select k.user_id, coalesce(s.owner_names, '{}'), k.rl_count > 60, s.suspended_at is not null
  from k
  left join public.user_settings s on s.user_id = k.user_id;
$$;

revoke all on function public.authenticate_api_key(text) from public, anon, authenticated;
grant execute on function public.authenticate_api_key(text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC cho edge function `admin` — CHỈ service_role
--
-- p_admin do function truyền từ JWT đã kiểm, không nhận từ client. Email / đăng nhập cuối /
-- ban lấy từ GoTrue ở function (ghép theo id) — RPC không đọc auth.users.
-- ---------------------------------------------------------------------------

-- Thống kê 30 ngày theo user: CHỈ đếm, không trả nội dung giao dịch.
-- tx_count_30d chỉ đếm giao dịch PARSER ghi: giao dịch user tự ghi từ hộp tin (resolve_unparsed)
-- có tin gốc vẫn nằm trong unparsed_30d -> đếm cả hai thì tỉ lệ parse bị thổi phồng.
-- suspended_reason lấy từ audit 'suspend' gần nhất (không lưu ở user_settings — user đọc được bảng đó).
drop function if exists public.admin_user_stats(uuid[]);
create or replace function public.admin_user_stats(p_user_ids uuid[] default null)
returns table (
  user_id            uuid,
  suspended_at       timestamptz,
  suspended_reason   text,
  consent_at         timestamptz,
  keys_active        int,
  keys_last_used_at  timestamptz,
  tx_count_30d       int,
  unparsed_30d       jsonb
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
              group by 1) r)
  from public.user_settings s
  where p_user_ids is null or s.user_id = any (p_user_ids);
$$;

create or replace function public.admin_user_keys(p_user uuid)
returns table (id uuid, name text, prefix text, last4 text,
               created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select k.id, k.name, k.prefix, k.last4, k.created_at, k.last_used_at, k.revoked_at
  from public.api_keys k
  where k.user_id = p_user
  order by k.revoked_at nulls first, k.created_at desc;
$$;

-- Khoá / mở khoá + audit trong 1 transaction. Khoá lại user đang bị khoá giữ mốc thời gian cũ.
create or replace function public.admin_set_suspended(
  p_admin uuid, p_user uuid, p_suspend boolean, p_reason text
)
returns void
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  update public.user_settings
  set suspended_at = case when p_suspend then coalesce(suspended_at, now()) end
  where user_id = p_user;
  if not found then
    raise exception 'user không tồn tại' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, reason)
  values (p_admin, case when p_suspend then 'suspend' else 'unsuspend' end, p_user, btrim(p_reason));
end;
$$;

-- Thu hồi mọi key còn hiệu lực + audit (payload ghi số key đã thu hồi). Trả số key.
create or replace function public.admin_revoke_user_keys(p_admin uuid, p_user uuid, p_reason text)
returns int
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (select 1 from public.user_settings where user_id = p_user) then
    raise exception 'user không tồn tại' using errcode = 'P0002';
  end if;

  with u as (
    update public.api_keys set revoked_at = now()
    where user_id = p_user and revoked_at is null
    returning 1
  )
  select count(*)::int into v_count from u;

  insert into public.admin_audit_log (admin_id, action, target_user_id, reason, payload)
  values (p_admin, 'revoke_keys', p_user, btrim(p_reason), jsonb_build_object('revoked', v_count));
  return v_count;
end;
$$;

-- Xem chi tiết 1 user cũng để lại dấu vết (ai xem dữ liệu của ai, lúc nào) — yêu cầu chứng minh
-- được theo luật dữ liệu cá nhân. Danh sách tổng không ghi.
create or replace function public.admin_log_view(p_admin uuid, p_user uuid)
returns void
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.admin_audit_log (admin_id, action, target_user_id, reason)
  values (p_admin, 'view_user', p_user, 'xem chi tiết user');
$$;

create or replace function public.admin_list_audit(p_user uuid default null, p_limit int default 50, p_offset int default 0)
returns table (id bigint, admin_id uuid, action text, target_user_id uuid, reason text, payload jsonb, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select a.id, a.admin_id, a.action, a.target_user_id, a.reason, a.payload, a.created_at
  from public.admin_audit_log a
  where p_user is null or a.target_user_id = p_user
  order by a.created_at desc, a.id desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

revoke all on function public.admin_user_stats(uuid[])                    from public, anon, authenticated;
revoke all on function public.admin_user_keys(uuid)                       from public, anon, authenticated;
revoke all on function public.admin_set_suspended(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.admin_revoke_user_keys(uuid, uuid, text)    from public, anon, authenticated;
revoke all on function public.admin_list_audit(uuid, int, int)            from public, anon, authenticated;
revoke all on function public.admin_log_view(uuid, uuid)                  from public, anon, authenticated;
grant execute on function public.admin_user_stats(uuid[])                    to service_role;
grant execute on function public.admin_user_keys(uuid)                       to service_role;
grant execute on function public.admin_set_suspended(uuid, uuid, boolean, text) to service_role;
grant execute on function public.admin_revoke_user_keys(uuid, uuid, text)    to service_role;
grant execute on function public.admin_list_audit(uuid, int, int)            to service_role;
grant execute on function public.admin_log_view(uuid, uuid)                  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Khoá có hiệu lực NGAY với access token còn hạn
--
-- Ban GoTrue chặn đăng nhập + refresh, nhưng JWT đang cầm vẫn hợp lệ tới jwt_expiry (đã kiểm:
-- REST vẫn 200 sau ban). Policy RESTRICTIVE được AND với mọi policy permissive hiện có — KHÔNG
-- phải admin bypass, policy cũ giữ nguyên. RPC security invoker (dashboard, xoá thẻ, resolve…)
-- chạy dưới RLS nên cũng bị chặn. user_settings KHÔNG gắn: UI cần đọc cờ để báo "bị khoá".
-- `(select ...)` để Postgres tính 1 lần mỗi truy vấn (initplan), không mỗi dòng.
-- ---------------------------------------------------------------------------
create or replace function public.is_suspended()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((select s.suspended_at is not null from public.user_settings s where s.user_id = auth.uid()), false);
$$;

revoke all on function public.is_suspended() from public, anon;
grant execute on function public.is_suspended() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['transactions', 'accounts', 'credit_cards', 'card_cashback_rules',
                           'card_cashback_rule_tiers', 'unparsed_messages', 'api_keys'] loop
    execute format('drop policy if exists not_suspended on public.%I', t);
    execute format(
      'create policy not_suspended on public.%I as restrictive for all to authenticated
         using (not (select public.is_suspended())) with check (not (select public.is_suspended()))', t);
  end loop;
end $$;
