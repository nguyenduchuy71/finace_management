-- Kiểm tra RLS / grant / RPC của migration 20261031100000_payment_orders_momo_zalopay.sql (2 user + user bị khoá).
--
-- Chạy trên Postgres 17 TẠM (giống credit-ledger-rls.sql), không đụng stack Supabase đang chạy:
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -f - < supabase/tests/payment-orders-rls.sql | grep -E "PASS|FAIL|ERROR"
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

\set A '\'aaaaaaaa-0000-4000-a000-00000000000a\'::uuid'
\set B '\'bbbbbbbb-0000-4000-a000-00000000000b\'::uuid'
\set S '\'55555555-0000-4000-a000-000000000005\'::uuid'
insert into auth.users values (:A, null), (:B, null), (:S, null);
insert into user_settings (user_id) values (:A), (:B), (:S) on conflict do nothing;

-- ===== gói
select t.check('seed 3 gói', (select count(*)::text from credit_packages), '3');
select t.check('authenticated thấy gói active', t.val('authenticated', :A, 'select count(*)::text from credit_packages'), '3');
update credit_packages set active = false where id = 'p200k';
select t.check('gói inactive bị ẩn khỏi authenticated', t.val('authenticated', :A, 'select count(*)::text from credit_packages'), '2');
update credit_packages set active = true where id = 'p200k';
select t.check('authenticated KHÔNG sửa giá gói (42501)',
  t.state('authenticated', :A, $$update credit_packages set price_vnd = 1000$$), '42501');
select t.check('authenticated KHÔNG chèn gói (42501)',
  t.state('authenticated', :A, $$insert into credit_packages values ('x', 1, 1000, true, 9)$$), '42501');
select t.check('anon KHÔNG đọc gói (42501)', t.state('anon', null, 'select * from credit_packages'), '42501');

-- ===== tạo đơn qua RPC service_role
select t.check('service_role tạo đơn momo p50k', t.val('service_role', null,
  format($$select (create_payment_order(%L, 'momo', 'p50k')).amount_vnd::text$$, :A)), '50000');
select t.check('ref dạng yymmdd_ + 12 ký tự [a-z0-9], ≤ 40', (select
  (provider_order_ref ~ '^[0-9]{6}_[a-z0-9]{12}$' and length(provider_order_ref) <= 40)::text from payment_orders where user_id = :A), 'true');
select t.check('ref dùng ngày GMT+7', (select (left(provider_order_ref, 6) = to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD'))::text
  from payment_orders where user_id = :A), 'true');
select t.check('đơn chụp credits từ gói (500)', (select credits::text from payment_orders where user_id = :A), '500');
select t.check('gói lạ -> P0002', t.state('service_role', null, format($$select create_payment_order(%L, 'momo', 'nope')$$, :A)), 'P0002');
select t.check('provider lạ -> 22023', t.state('service_role', null, format($$select create_payment_order(%L, 'paypal', 'p50k')$$, :A)), '22023');
select t.check('user lạ -> FK 23503', t.state('service_role', null,
  $$select create_payment_order('99999999-0000-4000-a000-000000000009', 'momo', 'p50k')$$), '23503');
-- giới hạn 5 đơn pending chưa hết hạn
select t.val('service_role', null, format($$select count(create_payment_order(%L, 'zalopay', 'p100k'))::text from generate_series(1,4)$$, :A));
select t.check('5 đơn pending/user', (select count(*)::text from payment_orders where user_id = :A), '5');
select t.check('đơn thứ 6 -> 22023', t.state('service_role', null, format($$select create_payment_order(%L, 'momo', 'p50k')$$, :A)), '22023');
update payment_orders set expires_at = now() - interval '1 minute' where user_id = :A and provider = 'zalopay';
select t.check('đơn hết hạn không tính vào giới hạn', t.state('service_role', null, format($$select create_payment_order(%L, 'momo', 'p50k')$$, :A)), 'ok');
-- user bị khoá
update user_settings set suspended_at = now() where user_id = :S;
select t.check('user bị khoá không tạo được đơn (42501)', t.state('service_role', null, format($$select create_payment_order(%L, 'momo', 'p50k')$$, :S)), '42501');
update user_settings set suspended_at = null where user_id = :S;
select t.val('service_role', null, format($$select (create_payment_order(%L, 'momo', 'p50k')).id::text$$, :S));
select t.val('service_role', null, format($$select (create_payment_order(%L, 'momo', 'p50k')).id::text$$, :B));

-- ===== RLS chéo user
select t.check('A thấy 6 đơn của mình', t.val('authenticated', :A, 'select count(*)::text from payment_orders'), '6');
select t.check('B chỉ thấy đơn của B (1)', t.val('authenticated', :B, 'select count(*)::text from payment_orders'), '1');
select t.check('B không đọc được đơn của A theo id', t.val('authenticated', :B,
  format($$select count(*)::text from payment_orders where user_id = %L$$, :A)), '0');
select t.check('anon KHÔNG đọc đơn (42501)', t.state('anon', null, 'select * from payment_orders'), '42501');
update user_settings set suspended_at = now() where user_id = :S;
select t.check('user bị khoá không đọc được đơn (RESTRICTIVE not_suspended)', t.val('authenticated', :S, 'select count(*)::text from payment_orders'), '0');
update user_settings set suspended_at = null where user_id = :S;

-- ===== authenticated không ghi đơn / không đọc payment_events
select t.check('authenticated KHÔNG insert đơn (42501)', t.state('authenticated', :A,
  format($$insert into payment_orders (user_id, provider, provider_order_ref, package_id, amount_vnd, credits) values (%L,'momo','x','p50k',1000,1)$$, :A)), '42501');
select t.check('authenticated KHÔNG sửa status đơn của mình (42501)', t.state('authenticated', :A, $$update payment_orders set status = 'paid'$$), '42501');
select t.check('authenticated KHÔNG xoá đơn (42501)', t.state('authenticated', :A, 'delete from payment_orders'), '42501');
select t.check('authenticated KHÔNG đọc payment_events (42501)', t.state('authenticated', :A, 'select * from payment_events'), '42501');
select t.check('authenticated KHÔNG ghi payment_events (42501)', t.state('authenticated', :A,
  $$insert into payment_events (provider, source, result, payload) values ('momo','ipn','x','{}')$$), '42501');
select t.check('anon KHÔNG đọc payment_events (42501)', t.state('anon', null, 'select * from payment_events'), '42501');

-- ===== RPC chỉ service_role
select t.check('mọi RPC thanh toán: authenticated + anon đều bị chặn EXECUTE', (select count(*)::text from (
  select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('create_payment_order','get_payment_order','set_order_pay_url','fail_payment_order',
     'mark_order_checked','log_payment_event','list_orders_to_reconcile','fulfill_order','expire_stale_orders')
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')
          or not has_function_privilege('service_role', p.oid, 'execute'))) x), '0');
select t.check('authenticated gọi fulfill_order -> 42501', t.state('authenticated', :A,
  $$select fulfill_order('momo', 'x', 't1', 50000)$$), '42501');
select t.check('authenticated gọi create_payment_order -> 42501', t.state('authenticated', :A,
  format($$select create_payment_order(%L, 'momo', 'p50k')$$, :A)), '42501');
select t.check('anon gọi fulfill_order -> 42501', t.state('anon', null, $$select fulfill_order('momo', 'x', 't1', 50000)$$), '42501');
select t.check('payment_events: service_role ghi được', t.state('service_role', null,
  $$select log_payment_event('momo', 'r', null, 'ipn', 'ok', '{"a":1}')$$), 'ok');
select t.check('fulfill_order thiếu tx_id -> 22023', t.state('service_role', null, $$select fulfill_order('momo', 'x', '', 1)$$), '22023');
