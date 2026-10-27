-- Nhiều người dùng: API key theo user cho iOS Shortcut + cài đặt riêng từng user.
-- Kế hoạch: plans/261027-1012-saas-signup-api-key-credits/ (phase 1)
--
-- Trước migration này edge function là single-tenant: 1 SHORTCUT_SECRET chung +
-- DEFAULT_USER_ID cố định + OWNER_NAMES là secret toàn cục. Đường cũ vẫn chạy song
-- song tới phase 4.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. user_settings — cài đặt riêng từng user
--
-- owner_names thay secret OWNER_NAMES (nhận diện chuyển nội bộ, internal-transfer.ts):
-- mỗi user có tên chủ TK khác nhau nên không thể là biến môi trường chung.
-- privacy_*: thời điểm + phiên bản chính sách user đã đồng ý lúc đăng ký.
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id                uuid primary key default auth.uid()
                         references auth.users(id) on delete cascade,
  owner_names            text[] not null default '{}'
                         check (cardinality(owner_names) <= 10),
  privacy_consent_at     timestamptz,
  privacy_policy_version text
);

alter table public.user_settings enable row level security;

create policy user_settings_select_own on public.user_settings
  for select to authenticated using (auth.uid() = user_id);
create policy user_settings_update_own on public.user_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Không insert/delete từ client: dòng sinh bởi trigger đăng ký, xoá theo cascade.
-- Consent chỉ ghi lúc đăng ký -> user không sửa được.
revoke all on public.user_settings from anon, authenticated;
grant select on public.user_settings to authenticated;
grant update (owner_names) on public.user_settings to authenticated;
grant select on public.user_settings to service_role;

-- User đã có từ thời single-tenant.
insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Trigger đăng ký: security definer là NGOẠI LỆ có chủ đích (mẫu chuẩn của Supabase) —
-- chạy dưới role của GoTrue, không phải user, và không gọi được như RPC.
-- Consent đọc từ metadata signUp (options.data.privacy_policy_version).
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
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. api_keys — nhiều key/user, lưu SHA-256, hiện plaintext đúng 1 lần
--
-- Key 'vj_' + 32 byte ngẫu nhiên (base64url) = 256-bit entropy -> SHA-256 thuần là
-- đủ và tra được bằng index UNIQUE (bcrypt/argon2 có salt thì không tra index được).
-- rl_*: rate limit cửa sổ cố định 1 phút, đếm ở DB vì edge function nhiều instance.
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null check (length(name) between 1 and 50),
  prefix          text not null,
  last4           text not null,
  key_hash        bytea not null unique,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  rl_window_start timestamptz,
  rl_count        int not null default 0
);

create index if not exists api_keys_user_idx on public.api_keys (user_id, created_at desc);

alter table public.api_keys enable row level security;

create policy api_keys_select_own on public.api_keys
  for select to authenticated using (auth.uid() = user_id);
create policy api_keys_insert_own on public.api_keys
  for insert to authenticated with check (auth.uid() = user_id);
create policy api_keys_update_own on public.api_keys
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- authenticated KHÔNG đọc key_hash / rl_*, chỉ sửa tên + thu hồi. Insert cần cho
-- create_api_key (security invoker); tự chèn hash bằng tay chỉ tạo key cho chính mình.
revoke all on public.api_keys from anon, authenticated;
grant select (id, user_id, name, prefix, last4, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;
grant insert (name, prefix, last4, key_hash) on public.api_keys to authenticated;
grant update (name, revoked_at) on public.api_keys to authenticated;
grant select, update on public.api_keys to service_role;

-- Thu hồi là vĩnh viễn (key đã lộ thì "bỏ thu hồi" là mở lại lỗ hổng) + tối đa
-- 10 key còn hiệu lực/user. Khoá advisory theo user để 2 lần tạo song song không vượt trần.
create or replace function public.api_keys_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
      raise exception 'api key đã thu hồi' using errcode = '22023';
    end if;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('api_keys:' || new.user_id::text));
  if (select count(*) from public.api_keys
      where user_id = new.user_id and revoked_at is null) >= 10 then
    raise exception 'tối đa 10 api key' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists api_keys_guard on public.api_keys;
create trigger api_keys_guard
  before insert or update on public.api_keys
  for each row execute function public.api_keys_guard();

-- Tạo key: trả plaintext ĐÚNG 1 lần, DB chỉ giữ hash. Sinh ở DB để chắc entropy đủ.
create or replace function public.create_api_key(p_name text)
returns text
language plpgsql
volatile
security invoker
set search_path = public, extensions
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  -- translate bỏ '=' (chuỗi đích ngắn hơn) và đổi +/ thành -_ (base64url)
  v_key  text := 'vj_' || translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
begin
  if length(v_name) not between 1 and 50 then
    raise exception 'tên key 1..50 ký tự' using errcode = '22023';
  end if;
  insert into public.api_keys (name, prefix, last4, key_hash)
  values (v_name, left(v_key, 9), right(v_key, 4), digest(v_key, 'sha256'));
  return v_key;
end;
$$;

revoke all on function public.create_api_key(text) from public, anon;
grant execute on function public.create_api_key(text) to authenticated;

-- Xác thực key cho edge function — CHỈ service_role. Một UPDATE ... RETURNING: tăng
-- bộ đếm rate limit + last_used_at và trả chủ key cùng owner_names.
-- 0 dòng = key sai / đã thu hồi. p_key_hash: hex SHA-256 do edge function tính
-- (plaintext key không đi vào DB).
create or replace function public.authenticate_api_key(p_key_hash text)
returns table (user_id uuid, owner_names text[], rate_limited boolean)
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
  select k.user_id, coalesce(s.owner_names, '{}'), k.rl_count > 60
  from k
  left join public.user_settings s on s.user_id = k.user_id;
$$;

revoke all on function public.authenticate_api_key(text) from public, anon, authenticated;
grant execute on function public.authenticate_api_key(text) to service_role;
