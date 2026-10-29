-- Kiểm tra invoke_payment_reconcile (migration 20261103100000): quyền + đường trả sớm + gọi pg_net đúng khi có secret.
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
