-- Kiểm tra invoke_payment_reconcile (20261103100000 + 20261103120000): quyền + đường trả sớm + gọi pg_net đúng khi có secret
-- + mỗi kết quả được ghi vào payment_events + admin_reconcile_status.
-- Postgres trần không có pg_net/vault -> test dựng STUB (schema net + vault) để chạy cả nhánh "có secret".
--
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -f - < supabase/tests/payment-reconcile-cron.sql | grep -E "PASS|FAIL|ERROR"
--   docker rm -f scratch-pg17
-- File chỉ chạy được MỘT lần trên mỗi DB (dựng stub). Không chạy trên stack Supabase thật (nó đã có net/vault thật).
\set ON_ERROR_STOP on
create schema if not exists t;
create or replace function t.check(label text, got text, want text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: want [%] got [%]', label, want, got; end if;
  raise notice 'PASS %', label;
end $$;
create or replace function t.as_role(role_name text, stmt text) returns text language plpgsql as $$
declare got text := 'ok';
begin
  execute format('set local role %I', role_name);
  begin execute stmt; exception when others then got := sqlstate; end;
  reset role;
  return got;
end $$;
create or replace function t.n(q text) returns text language plpgsql as $$
declare r text; begin execute q into r; return r; end $$;

-- 0. Chưa có lần đối soát nào: trạng thái rỗng, không lỗi
select t.check('chưa có sự kiện -> last_outcome null, stale 0', (select coalesce(last_outcome, 'null') || '|' || stale_pending from public.admin_reconcile_status()), 'null|0');

-- 1. Quyền
select t.check('anon không gọi được', t.as_role('anon', 'select public.invoke_payment_reconcile()'), '42501');
select t.check('authenticated không gọi được', t.as_role('authenticated', 'select public.invoke_payment_reconcile()'), '42501');
select t.check('service_role gọi được', t.as_role('service_role', 'select public.invoke_payment_reconcile()'), 'ok');
select t.check('không security definer', (select (not prosecdef)::text from pg_proc where proname = 'invoke_payment_reconcile'), 'true');

-- 2. Thiếu pg_net -> trả sớm
select t.check('thiếu pg_net -> skipped:no_pg_net', public.invoke_payment_reconcile(), 'skipped:no_pg_net');

-- 3. Có pg_net (stub ghi lại lời gọi) nhưng thiếu vault -> trả sớm
create schema net;
create table net.calls(url text, headers jsonb, body jsonb);
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
  headers jsonb default '{"Content-Type":"application/json"}', timeout_milliseconds integer default 5000)
  returns bigint language sql as $$ insert into net.calls values (url, headers, body) returning 1::bigint $$;
select t.check('thiếu vault -> skipped:no_vault', public.invoke_payment_reconcile(), 'skipped:no_vault');

-- 4. Có vault nhưng chưa đặt secret -> KHÔNG gọi net
create schema vault;
create table vault.secrets(name text, secret text);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
select t.check('chưa có secret -> skipped:no_secret', public.invoke_payment_reconcile(), 'skipped:no_secret');
insert into vault.secrets values ('payment_reconcile_url', 'https://x.supabase.co/functions/v1/payment-reconcile');
select t.check('chỉ có URL, thiếu secret -> skipped:no_secret', public.invoke_payment_reconcile(), 'skipped:no_secret');
delete from vault.secrets;
insert into vault.secrets values ('payment_reconcile_secret', 'S3CRET');
select t.check('chỉ có secret, thiếu URL -> skipped:no_secret', public.invoke_payment_reconcile(), 'skipped:no_secret');
insert into vault.secrets values ('payment_reconcile_url', '');
delete from vault.secrets where name = 'payment_reconcile_url' and secret = '';
select t.check('các ca trả sớm không gọi net', t.n('select count(*) from net.calls'), '0');

-- 5. Đủ cả hai -> gọi net đúng URL + header
insert into vault.secrets values ('payment_reconcile_url', 'https://x.supabase.co/functions/v1/payment-reconcile');
select t.check('đủ secret -> sent', public.invoke_payment_reconcile(), 'sent');
select t.check('gọi đúng URL', t.n('select url from net.calls'), 'https://x.supabase.co/functions/v1/payment-reconcile');
select t.check('header x-reconcile-secret lấy từ vault', t.n($$select headers->>'x-reconcile-secret' from net.calls$$), 'S3CRET');
select t.check('migration không chứa secret/URL: lệnh job chỉ gọi hàm', (select (position('S3CRET' in prosrc) = 0
  and position('supabase.co' in prosrc) = 0)::text from pg_proc where proname = 'invoke_payment_reconcile'), 'true');

-- 6. Mỗi lần gọi ghi 1 dòng payment_events (kể cả trả sớm); không URL/secret trong dòng
select t.check('mỗi kết quả được ghi theo thứ tự', (select string_agg(result, ',' order by id) from payment_events where source = 'reconcile'),
  'skipped:no_pg_net,skipped:no_pg_net,skipped:no_vault,skipped:no_secret,skipped:no_secret,skipped:no_secret,sent');
select t.check('dòng reconcile: provider + source = reconcile', (select (count(*) = 7 and bool_and(provider = 'reconcile' and source = 'reconcile'))::text
  from payment_events where source = 'reconcile'), 'true');
select t.check('dòng sent mang request_id của pg_net', (select payload ->> 'request_id' from payment_events where result = 'sent'), '1');
select t.check('không dòng nào chứa secret hoặc URL', (select (count(*) = 0)::text from payment_events
  where (payload::text || result) like '%S3CRET%' or (payload::text || result) like '%supabase.co%'), 'true');
select t.check('CHECK source vẫn chặn giá trị lạ', (select (count(*) = 0)::text from pg_constraint
  where conname = 'payment_events_source_check' and pg_get_constraintdef(oid) not like '%reconcile%'), 'true');

-- 7. admin_reconcile_status
select t.check('status: kết quả gần nhất + chưa có phản hồi pg_net -> http null', (select last_outcome || '|' || coalesce(last_http_status::text, 'null')
  from public.admin_reconcile_status()), 'sent|null');
create table net._http_response(id bigint, status_code int);
insert into net._http_response values (1, 200);
select t.check('status: có net._http_response -> http 200', (select last_http_status::text from public.admin_reconcile_status()), '200');
update net._http_response set status_code = 401;
select t.check('status: phản hồi 401 hiện ra', (select last_http_status::text from public.admin_reconcile_status()), '401');
-- service_role không đọc được schema net -> http null, KHÔNG làm hỏng cả hàm.
do $$
declare v text;
begin
  set local role service_role;
  select last_outcome || '|' || coalesce(last_http_status::text, 'null') into v from public.admin_reconcile_status();
  reset role;
  perform t.check('service_role không đọc được net: http null, vẫn trả kết quả', v, 'sent|null');
end $$;
select t.check('authenticated không đọc status', t.as_role('authenticated', 'select * from public.admin_reconcile_status()'), '42501');
select t.check('anon không đọc status', t.as_role('anon', 'select * from public.admin_reconcile_status()'), '42501');

-- Đơn pending kẹt: > 15 phút VÀ (chưa hỏi provider HOẶC lần hỏi cuối > 15 phút trước)
insert into auth.users values ('dddddddd-0000-4000-a000-0000000000c1', null);
create table t.o as select id from create_payment_order('dddddddd-0000-4000-a000-0000000000c1', 'momo', 'p50k');
select t.check('đơn mới (< 15 phút) không tính', (select stale_pending::text from public.admin_reconcile_status()), '0');
update payment_orders set created_at = now() - interval '30 minutes' where id = (select id from t.o);
select t.check('đơn pending 30 phút chưa hỏi provider -> 1', (select stale_pending::text from public.admin_reconcile_status()), '1');
update payment_orders set last_checked_at = now() - interval '2 minutes' where id = (select id from t.o);
select t.check('vừa được đối soát -> 0', (select stale_pending::text from public.admin_reconcile_status()), '0');
update payment_orders set last_checked_at = now() - interval '20 minutes' where id = (select id from t.o);
select t.check('lần hỏi cuối 20 phút trước -> 1', (select stale_pending::text from public.admin_reconcile_status()), '1');
update payment_orders set status = 'paid' where id = (select id from t.o);
select t.check('đơn không còn pending không tính', (select stale_pending::text from public.admin_reconcile_status()), '0');
