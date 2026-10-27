-- Kiểm tra RLS / grant / RPC của migration 20261027100000_multi_tenant_api_keys.sql (2 user).
--
-- Chạy trên Postgres 17 TẠM (giống unparsed-accounts-rls.sql), không đụng stack Supabase đang chạy:
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -f - < supabase/tests/api-keys-rls.sql | grep -E "PASS|FAIL|ERROR"
--   docker rm -f scratch-pg17
-- Mỗi ca in PASS hoặc dừng bằng FAIL. File chỉ chạy được MỘT lần trên mỗi DB.
\set ON_ERROR_STOP on
create schema if not exists t;
create or replace function t.state(role_name text, uid uuid, stmt text) returns text language plpgsql as $$
declare got text := 'ok';
begin
  execute format('set local role %I', role_name);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  begin execute stmt; exception when others then got := sqlstate; end;
  reset role;
  return got;
end $$;
create or replace function t.val(role_name text, uid uuid, q text) returns text language plpgsql as $$
declare r text;
begin
  execute format('set local role %I', role_name);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  execute q into r;
  reset role;
  return r;
end $$;
create or replace function t.check(label text, got text, want text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: want [%] got [%]', label, want, got; end if;
  raise notice 'PASS %', label;
end $$;

-- A đăng ký có đồng ý chính sách, B không (vd user tạo bằng admin)
insert into auth.users values
 ('aaaaaaaa-0000-4000-a000-000000000001', '{"privacy_policy_version":"2026-10"}'),
 ('bbbbbbbb-0000-4000-a000-000000000002', null);

\set A '\'aaaaaaaa-0000-4000-a000-000000000001\'::uuid'
\set B '\'bbbbbbbb-0000-4000-a000-000000000002\'::uuid'

-- ===== user_settings
select t.check('trigger đăng ký tạo user_settings + consent', (select
  (privacy_policy_version = '2026-10' and privacy_consent_at is not null)::text
  from user_settings where user_id = :A), 'true');
select t.check('không metadata -> consent null', (select
  (privacy_consent_at is null)::text from user_settings where user_id = :B), 'true');
select t.check('A chỉ thấy settings của mình', t.val('authenticated', :A,
  $$select count(*)::text from user_settings$$), '1');
select t.check('A sửa owner_names', t.state('authenticated', :A,
  $$update user_settings set owner_names = '{NGUYEN VAN A}'$$), 'ok');
select t.check('A không sửa consent', t.state('authenticated', :A,
  $$update user_settings set privacy_consent_at = null$$), '42501');
select t.check('A không insert settings', t.state('authenticated', :A,
  $$insert into user_settings(user_id) values (auth.uid())$$), '42501');
select t.check('A sửa settings của B = 0 dòng', t.val('authenticated', :A,
  $$with u as (update user_settings set owner_names='{X}' where user_id='bbbbbbbb-0000-4000-a000-000000000002' returning 1) select count(*)::text from u$$), '0');
select t.check('anon không đọc settings', t.state('anon', null, $$select 1 from user_settings$$), '42501');

-- ===== create_api_key
create temp table keys(owner text, k text);
insert into keys select 'A', t.val('authenticated', :A, $$select create_api_key('iPhone')$$);
insert into keys select 'B', t.val('authenticated', :B, $$select create_api_key('iPad')$$);

select t.check('định dạng key vj_ + 43 ký tự base64url', (select
  (k ~ '^vj_[A-Za-z0-9_-]{43}$')::text from keys where owner='A'), 'true');
select t.check('prefix/last4 khớp plaintext, hash = sha256', (select
  (a.prefix = left(k.k, 9) and a.last4 = right(k.k, 4) and a.key_hash = digest(k.k, 'sha256'))::text
  from api_keys a, keys k where k.owner='A' and a.user_id = :A), 'true');
select t.check('tên rỗng -> 22023', t.state('authenticated', :A, $$select create_api_key('  ')$$), '22023');
select t.check('anon không tạo key', t.state('anon', null, $$select create_api_key('x')$$), '42501');

-- ===== đọc / sửa api_keys
select t.check('A chỉ thấy key của mình', t.val('authenticated', :A,
  $$select count(*)::text from api_keys$$), '1');
select t.check('A không đọc key_hash', t.state('authenticated', :A,
  $$select key_hash from api_keys$$), '42501');
select t.check('A không đọc rl_count', t.state('authenticated', :A,
  $$select rl_count from api_keys$$), '42501');
select t.check('A không sửa key_hash', t.state('authenticated', :A,
  $$update api_keys set key_hash = '\x00'$$), '42501');
select t.check('A không delete key', t.state('authenticated', :A, $$delete from api_keys$$), '42501');
select t.check('A thu hồi key của B = 0 dòng', t.val('authenticated', :A,
  $$with u as (update api_keys set revoked_at = now() where user_id='bbbbbbbb-0000-4000-a000-000000000002' returning 1) select count(*)::text from u$$), '0');
-- user_id không có grant insert -> luôn là default auth.uid()
select t.check('A không tự đặt user_id khi insert', t.state('authenticated', :A,
  $$insert into api_keys(user_id,name,prefix,last4,key_hash) values ('bbbbbbbb-0000-4000-a000-000000000002','x','x','x','\x01')$$), '42501');

-- ===== authenticate_api_key
select t.check('authenticated không gọi được authenticate_api_key', t.state('authenticated', :A,
  $$select * from authenticate_api_key(repeat('0', 64))$$), '42501');
select t.check('anon không gọi được authenticate_api_key', t.state('anon', null,
  $$select * from authenticate_api_key(repeat('0', 64))$$), '42501');
select t.check('service_role: key A -> user A + owner_names', t.val('service_role', null,
  format($$select user_id::text || '|' || array_to_string(owner_names, ',') || '|' || rate_limited::text
           from authenticate_api_key(%L)$$, (select encode(digest(k, 'sha256'), 'hex') from keys where owner='A'))),
  'aaaaaaaa-0000-4000-a000-000000000001|NGUYEN VAN A|false');
select t.check('last_used_at được ghi', (select (last_used_at is not null)::text from api_keys where user_id = :A), 'true');
select t.check('hash lạ -> 0 dòng', t.val('service_role', null,
  $$select count(*)::text from authenticate_api_key(repeat('0', 64))$$), '0');

-- rate limit: đã 1 lần ở trên, gọi thêm 59 -> lần 60 chưa chặn, lần 61 chặn
do $$
declare h text := (select encode(digest(k, 'sha256'), 'hex') from keys where owner='A');
begin
  for i in 1..59 loop perform * from authenticate_api_key(h); end loop;
end $$;
select t.check('lần 61 trong phút -> rate_limited', t.val('service_role', null,
  format($$select rate_limited::text from authenticate_api_key(%L)$$,
         (select encode(digest(k, 'sha256'), 'hex') from keys where owner='A'))), 'true');
update api_keys set rl_window_start = now() - interval '2 minutes' where user_id = :A;
select t.check('qua cửa sổ mới -> hết chặn', t.val('service_role', null,
  format($$select rate_limited::text from authenticate_api_key(%L)$$,
         (select encode(digest(k, 'sha256'), 'hex') from keys where owner='A'))), 'false');

-- ===== thu hồi
select t.check('A thu hồi key của mình', t.state('authenticated', :A,
  $$update api_keys set revoked_at = now()$$), 'ok');
select t.check('key đã thu hồi -> 0 dòng', t.val('service_role', null,
  format($$select count(*)::text from authenticate_api_key(%L)$$,
         (select encode(digest(k, 'sha256'), 'hex') from keys where owner='A'))), '0');
select t.check('bỏ thu hồi -> 22023', t.state('authenticated', :A,
  $$update api_keys set revoked_at = null$$), '22023');
select t.check('đổi tên key đã thu hồi vẫn được', t.state('authenticated', :A,
  $$update api_keys set name = 'iPhone cũ'$$), 'ok');

-- ===== trần 10 key còn hiệu lực (key thu hồi không tính)
do $$ begin
  for i in 1..10 loop perform t.state('authenticated', 'aaaaaaaa-0000-4000-a000-000000000001', format($q$select create_api_key('k%s')$q$, i)); end loop;
end $$;
select t.check('10 key còn hiệu lực', (select count(*)::text from api_keys where user_id = :A and revoked_at is null), '10');
select t.check('key thứ 11 -> 22023', t.state('authenticated', :A, $$select create_api_key('k11')$$), '22023');

-- ===== xoá user cascade
delete from auth.users where id = :B;
select t.check('xoá user B -> hết key + settings của B', (select
  ((select count(*) from api_keys where user_id = :B) + (select count(*) from user_settings where user_id = :B))::text), '0');
