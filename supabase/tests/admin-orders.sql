-- Kiểm tra admin_list_orders / admin_resolve_order / admin_order_owner (migrations 20261103110000 + 20261103120000): quyền, mark_paid cộng ĐÚNG 1 lần
-- (tuần tự + song song), audit + sổ cái cùng transaction, đơn paid không xử lý lại, mark_failed.
-- 3 giai đoạn như payment-fulfill.sql:
--
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -v stage=seq -f - < supabase/tests/admin-orders.sql | grep -E "PASS|FAIL|ERROR"
--   $P -v stage=setup -f - < supabase/tests/admin-orders.sql
--   R=$($P -At -c "select provider_order_ref from payment_orders where user_id='dddddddd-0000-4000-a000-0000000000d1'")
--   for i in 1 2 3 4; do $P -c "select admin_resolve_order('dddddddd-0000-4000-a000-0000000000ad', (select id from payment_orders where provider_order_ref='$R'), 'mark_paid', 'song song $i', 'TXPAR')" & done; wait
--   $P -v stage=assert -f - < supabase/tests/admin-orders.sql | grep -E "PASS|FAIL|ERROR"
--   docker rm -f scratch-pg17
-- Phiên song song chạy bằng postgres (kiểm LOGIC khoá/idempotency); quyền kiểm ở stage=seq bằng set role.
\set ON_ERROR_STOP on
create schema if not exists t;
create or replace function t.check(label text, got text, want text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: want [%] got [%]', label, want, got; end if;
  raise notice 'PASS %', label;
end $$;
create or replace function t.order_ref(uid uuid, prov text, pkg text) returns text language plpgsql as $$
declare r text;
begin select provider_order_ref into r from create_payment_order(uid, prov, pkg); return r; end $$;
create or replace function t.oid(ref text) returns uuid language sql as $$ select id from payment_orders where provider_order_ref = ref $$;
create or replace function t.bal(uid uuid) returns text language plpgsql as $$
declare r text; begin select balance::text into r from credit_balances where user_id = uid; return r; end $$;
create or replace function t.st(ref text) returns text language plpgsql as $$
declare r text; begin select status into r from payment_orders where provider_order_ref = ref; return r; end $$;
create or replace function t.n(q text) returns text language plpgsql as $$
declare r text; begin execute q into r; return r; end $$;
create or replace function t.sqlstate(stmt text) returns text language plpgsql as $$
declare got text := 'ok';
begin begin execute stmt; exception when others then got := sqlstate; end; return got; end $$;
create or replace function t.as_role(role_name text, stmt text) returns text language plpgsql as $$
declare got text := 'ok';
begin
  execute format('set local role %I', role_name);
  begin execute stmt; exception when others then got := sqlstate; end;
  reset role;
  return got;
end $$;
create or replace function t.resolve(adm uuid, ref text, opt text, why text, tx text default null) returns text language plpgsql as $$
begin return admin_resolve_order(adm, t.oid(ref), opt, why, tx)::text; exception when others then return sqlstate; end $$;

select :'stage' = 'seq' as is_seq, :'stage' = 'setup' as is_setup, :'stage' = 'assert' as is_assert \gset
\set ADMT 'dddddddd-0000-4000-a000-0000000000ad'
\set ADM '\'dddddddd-0000-4000-a000-0000000000ad\'::uuid'
\if :is_seq
  \set A '\'dddddddd-0000-4000-a000-0000000000a1\'::uuid'
  \set B '\'dddddddd-0000-4000-a000-0000000000a2\'::uuid'
  insert into auth.users values (:A, null), (:B, null);
  create table t.refs as select
    t.order_ref(:A, 'momo', 'p50k') as mm, t.order_ref(:A, 'zalopay', 'p100k') as ex, t.order_ref(:A, 'momo', 'p200k') as pd,
    t.order_ref(:A, 'momo', 'p50k') as fl, t.order_ref(:A, 'momo', 'p50k') as at, t.order_ref(:B, 'zalopay', 'p50k') as ob,
    t.order_ref(:B, 'momo', 'p50k') as kt;

  -- Quyền: chỉ service_role.
  select t.check('authenticated không list', t.as_role('authenticated', 'select * from admin_list_orders()'), '42501');
  select t.check('anon không list', t.as_role('anon', 'select * from admin_list_orders()'), '42501');
  select t.check('authenticated không resolve', t.as_role('authenticated',
    format('select admin_resolve_order(%L, %L, ''mark_paid'', ''khong duoc'')', :'ADMT', t.oid((select mm from t.refs)))), '42501');
  select t.check('anon không resolve', t.as_role('anon',
    format('select admin_resolve_order(%L, %L, ''mark_paid'', ''khong duoc'')', :'ADMT', t.oid((select mm from t.refs)))), '42501');
  select t.check('service_role list được', t.as_role('service_role', 'select * from admin_list_orders()'), 'ok');
  select t.check('service_role resolve option lạ -> 22023', t.as_role('service_role',
    format('select admin_resolve_order(%L, %L, ''delete'', ''ly do hop le'')', :'ADMT', t.oid((select mm from t.refs)))), '22023');

  -- List: lọc + metadata.
  update payment_orders set status = 'mismatch', provider_tx_id = 'TXM' where provider_order_ref = (select mm from t.refs);
  update payment_orders set status = 'expired' where provider_order_ref = (select ex from t.refs);
  update payment_orders set status = 'mismatch', provider_tx_id = 'TXKEEP' where provider_order_ref = (select kt from t.refs);
  select t.check('list: lọc status', t.n($$select count(*) from admin_list_orders('mismatch')$$), '2');
  select t.check('list: lọc provider', t.n($$select count(*) from admin_list_orders(null, 'zalopay')$$), '2');
  select t.check('list: lọc user', t.n(format('select count(*) from admin_list_orders(null, null, %L)', 'dddddddd-0000-4000-a000-0000000000a2')), '2');
  select t.check('list: status lạ -> 22023', t.sqlstate($$select * from admin_list_orders('hack')$$), '22023');
  select t.check('list: provider lạ -> 22023', t.sqlstate($$select * from admin_list_orders(null, 'paypal')$$), '22023');
  select t.check('list: không có cột pay_url/payload', (select (count(*) = 0)::text from information_schema.parameters
    where specific_name like 'admin_list_orders%' and parameter_mode = 'OUT' and parameter_name in ('pay_url', 'payload')), 'true');
  select t.check('list: limit quá lớn bị kẹp (chỉ có 7 dòng)', t.n($$select count(*) from admin_list_orders(null, null, null, 100000)$$), '7');
  select t.check('list: limit 2', t.n($$select count(*) from admin_list_orders(null, null, null, 2)$$), '2');

  -- Admin không xử lý đơn của chính mình.
  insert into auth.users values ('dddddddd-0000-4000-a000-0000000000ad', null) on conflict do nothing;
  select t.check('đơn của chính admin -> 42501', t.sqlstate(format('select admin_resolve_order(%L, %L, ''mark_paid'', ''tu cong cho minh'')',
    :'ADMT', t.oid(t.order_ref(:'ADMT'::uuid, 'momo', 'p50k')))), '42501');

  -- mark_paid (đơn mismatch): +500, audit + sổ cái, tx_id giữ nguyên.
  select t.check('mark_paid: ok', (t.resolve(:ADM, (select mm from t.refs), 'mark_paid', 'đã đối chiếu sao kê'))::jsonb ->> 'status', 'paid');
  select t.check('mark_paid: số dư 100 + 500', t.bal(:A), '600');
  select t.check('mark_paid: status paid, paid_at, giữ tx_id', (select (status = 'paid' and paid_at is not null and provider_tx_id = 'TXM')::text
    from payment_orders where provider_order_ref = (select mm from t.refs)), 'true');
  select t.check('mark_paid: 1 dòng sổ cái purchase ref = order.id', t.n(format(
    'select count(*) from credit_ledger where kind = ''purchase'' and ref = %L and delta = 500', t.oid((select mm from t.refs))::text)), '1');
  select t.check('mark_paid: 1 dòng audit order_mark_paid kèm payload', t.n(format(
    'select count(*) from admin_audit_log where action = ''order_mark_paid'' and target_user_id = %L and payload->>''order_id'' = %L and payload->>''from_status'' = ''mismatch''',
    'dddddddd-0000-4000-a000-0000000000a1', t.oid((select mm from t.refs))::text)), '1');
  -- Gọi lại: đơn paid không xử lý được lần 2, không cộng, không thêm audit.
  select t.check('mark_paid lần 2 -> 55000', t.resolve(:ADM, (select mm from t.refs), 'mark_paid', 'bấm lại lần hai'), '55000');
  select t.check('mark_failed trên đơn paid -> 55000', t.resolve(:ADM, (select mm from t.refs), 'mark_failed', 'bấm nhầm đơn paid'), '55000');
  select t.check('lần 2: số dư vẫn 600, audit vẫn 1, sổ cái vẫn 1', t.bal(:A) || '|' || t.n($$select count(*) from admin_audit_log where action like 'order_%'$$)
    || '|' || t.n($$select count(*) from credit_ledger where kind = 'purchase'$$), '600|1|1');
  -- IPN muộn tới sau mark_paid: fulfill không cộng lần 2.
  select t.check('IPN muộn sau mark_paid: mismatch, không cộng', fulfill_order('momo', (select mm from t.refs), 'TXLATE', 50000) || '|' || t.bal(:A), 'mismatch|600');

  -- mark_paid trên đơn expired + pending, đơn không tồn tại, lý do sai.
  -- M1: đơn CHƯA có mã giao dịch -> mark_paid bắt buộc mã (trim, 1..100); sai thì đơn/số dư/audit không đổi.
  select t.check('mark_paid thiếu mã (đơn chưa có tx) -> 22023', t.resolve(:ADM, (select ex from t.refs), 'mark_paid', 'khách gửi biên lai'), '22023');
  select t.check('mark_paid mã toàn khoảng trắng -> 22023', t.resolve(:ADM, (select ex from t.refs), 'mark_paid', 'khách gửi biên lai', '   '), '22023');
  select t.check('mark_paid mã > 100 ký tự -> 22023', t.resolve(:ADM, (select ex from t.refs), 'mark_paid', 'khách gửi biên lai', repeat('x', 101)), '22023');
  select t.check('mã sai: đơn vẫn expired, không cộng, không audit', t.st((select ex from t.refs)) || '|' || t.bal(:A) || '|' ||
    t.n($$select count(*) from admin_audit_log where reason = 'khách gửi biên lai'$$), 'expired|600|0');
  -- Mã đã gắn cho đơn khác (cùng provider) -> 23505, cả transaction rollback.
  select t.check('mã đã dùng ở đơn khác (cùng provider) -> 23505', t.resolve(:ADM, (select pd from t.refs), 'mark_paid', 'trùng mã giao dịch', 'TXM'), '23505');
  select t.check('23505: đơn pending, số dư + audit không đổi', t.st((select pd from t.refs)) || '|' || t.bal(:A) || '|' ||
    t.n($$select count(*) from admin_audit_log where reason = 'trùng mã giao dịch'$$), 'pending|600|0');
  -- Đơn đã có mã: giữ mã cũ, bỏ qua mã truyền vào.
  select t.check('đơn đã có tx: mark_paid không cần mã', (t.resolve(:ADM, (select kt from t.refs), 'mark_paid', 'đã đối chiếu sao kê'))::jsonb ->> 'credits', '500');
  select t.check('  ... giữ TXKEEP + audit ghi TXKEEP', t.n($$select provider_tx_id from payment_orders where status = 'paid' and provider_tx_id = 'TXKEEP'$$) || '|' ||
    t.n($$select payload->>'provider_tx_id' from admin_audit_log where action = 'order_mark_paid' and payload->>'provider_tx_id' = 'TXKEEP'$$), 'TXKEEP|TXKEEP');
  select t.check('  ... credit cộng cho chủ đơn (B: 100 + 500), A không đổi', t.bal(:B) || '|' || t.bal(:A), '600|600');
  select t.check('mark_paid kèm mã (đơn chưa có tx): lưu mã đã trim', (t.resolve(:ADM, (select ex from t.refs), 'mark_paid', 'khách gửi biên lai', '  TXEX  '))::jsonb ->> 'credits', '1200');
  select t.check('  ... provider_tx_id = TXEX', t.n(format('select provider_tx_id from payment_orders where id = %L', t.oid((select ex from t.refs)))), 'TXEX');
  select t.check('  ... audit payload có provider_tx_id', t.n(format($$select payload->>'provider_tx_id' from admin_audit_log
    where action = 'order_mark_paid' and payload->>'order_id' = %L$$, t.oid((select ex from t.refs))::text)), 'TXEX');
  select t.check('  ... IPN muộn với đúng mã TXEX -> duplicate', fulfill_order('zalopay', (select ex from t.refs), 'TXEX', 100000), 'duplicate');
  select t.check('  ... số dư 1800', t.bal(:A), '1800');
  select t.check('mark_paid pending: ok', (t.resolve(:ADM, (select at from t.refs), 'mark_paid', 'ipn thất lạc xác nhận', 'TXAT'))::jsonb ->> 'balance', '2300');
  select t.check('đơn không tồn tại -> P0002', t.sqlstate(format('select admin_resolve_order(%L, gen_random_uuid(), ''mark_paid'', ''ly do hop le'')', :'ADMT')), 'P0002');
  select t.check('lý do ngắn -> 23514, đơn không đổi', t.resolve(:ADM, (select pd from t.refs), 'mark_paid', 'abc', 'TXPD') || '|' || t.st((select pd from t.refs)) || '|' || t.bal(:A), '23514|pending|2300');
  select t.check('lý do dài > 500 -> 23514', t.resolve(:ADM, (select pd from t.refs), 'mark_paid', repeat('x', 501), 'TXPD'), '23514');

  -- mark_failed: không cộng; đơn failed không mark_failed lại nhưng vẫn mark_paid được.
  select t.check('mark_failed pending: ok', (t.resolve(:ADM, (select fl from t.refs), 'mark_failed', 'khách huỷ giao dịch'))::jsonb ->> 'status', 'failed');
  select t.check('mark_failed: không cộng, status failed', t.bal(:A) || '|' || t.st((select fl from t.refs)), '2300|failed');
  select t.check('mark_failed lần 2 -> 55000', t.resolve(:ADM, (select fl from t.refs), 'mark_failed', 'bấm lại lần hai'), '55000');
  select t.check('mark_failed bỏ qua mã truyền vào (không lưu)', t.n(format('select count(*) from payment_orders where id = %L and provider_tx_id is null', t.oid((select fl from t.refs)))), '1');
  select t.check('failed -> mark_paid được, +500', (t.resolve(:ADM, (select fl from t.refs), 'mark_paid', 'hoá ra đã thanh toán', 'TXFL'))::jsonb ->> 'balance', '2800');
  select t.check('mã TXEX (zalopay) đã gắn cho đơn của user A -> user B cùng provider cũng 23505',
    t.resolve(:ADM, (select ob from t.refs), 'mark_paid', 'khác user cùng mã', 'TXEX'), '23505');
  select t.check('mã đúng 100 ký tự hợp lệ ở biên', ((t.resolve(:ADM, (select ob from t.refs), 'mark_paid', 'mã dài đúng 100 ký tự', repeat('y', 100)))::jsonb ->> 'status'), 'paid');
  select t.check('  ... đã lưu đủ 100 ký tự', (select length(provider_tx_id)::text from payment_orders where provider_order_ref = (select ob from t.refs)), '100');
  -- admin_order_owner (edge function dùng để chặn đơn của admin): chủ đơn / null.
  select t.check('admin_order_owner trả chủ đơn', t.n(format('select admin_order_owner(%L)', t.oid((select kt from t.refs)))), 'dddddddd-0000-4000-a000-0000000000a2');
  select t.check('admin_order_owner đơn lạ -> null', coalesce(t.n('select admin_order_owner(gen_random_uuid())'), 'null'), 'null');
  select t.check('authenticated không gọi admin_order_owner', t.as_role('authenticated', 'select admin_order_owner(gen_random_uuid())'), '42501');
  select t.check('anon không gọi admin_order_owner', t.as_role('anon', 'select admin_order_owner(gen_random_uuid())'), '42501');
  select t.check('service_role gọi admin_order_owner', t.as_role('service_role', 'select admin_order_owner(gen_random_uuid())'), 'ok');
  select t.check('authenticated không gọi admin_reconcile_status', t.as_role('authenticated', 'select * from admin_reconcile_status()'), '42501');
  select t.check('anon không gọi admin_reconcile_status', t.as_role('anon', 'select * from admin_reconcile_status()'), '42501');
  select t.check('service_role gọi admin_reconcile_status', t.as_role('service_role', 'select * from admin_reconcile_status()'), 'ok');
  select t.check('hàm cũ 4 tham số đã bị xoá', (select count(*)::text from pg_proc where proname = 'admin_resolve_order' and pronargs = 4), '0');

  -- Cùng transaction: lỗi sau resolve -> audit, sổ cái, trạng thái cùng rollback.
  do $$
  declare r text := (select pd from t.refs); uid uuid := 'dddddddd-0000-4000-a000-0000000000a1';
  begin
    begin
      perform admin_resolve_order('dddddddd-0000-4000-a000-0000000000ad', t.oid(r), 'mark_paid', 'thử rollback cả hai', 'TXRB');
      raise exception 'boom';
    exception when others then null;
    end;
    perform t.check('rollback: audit không còn', t.n($q$select count(*) from admin_audit_log where reason = 'thử rollback cả hai'$q$), '0');
    perform t.check('rollback: sổ cái + trạng thái + số dư không đổi', t.st(r) || '|' || t.bal(uid) || '|' ||
      t.n(format($q$select count(*) from credit_ledger where kind='purchase' and ref = %L$q$, t.oid(r)::text)), 'pending|2800|0');
  end $$;
\endif

\if :is_setup
  insert into auth.users values ('dddddddd-0000-4000-a000-0000000000d1', null);
  select t.order_ref('dddddddd-0000-4000-a000-0000000000d1', 'momo', 'p50k');
  update payment_orders set status = 'expired' where user_id = 'dddddddd-0000-4000-a000-0000000000d1';
\endif

\if :is_assert
  select t.check('song song: số dư 100 + 500 (cộng đúng 1 lần)', t.bal('dddddddd-0000-4000-a000-0000000000d1'), '600');
  select t.check('song song: đúng 1 dòng sổ cái purchase', t.n($$select count(*) from credit_ledger l join payment_orders o on o.id::text = l.ref
    where l.kind = 'purchase' and o.user_id = 'dddddddd-0000-4000-a000-0000000000d1'$$), '1');
  select t.check('song song: đúng 1 dòng audit', t.n($$select count(*) from admin_audit_log
    where action = 'order_mark_paid' and target_user_id = 'dddddddd-0000-4000-a000-0000000000d1'$$), '1');
  select t.check('song song: đơn paid', t.n($$select status from payment_orders where user_id = 'dddddddd-0000-4000-a000-0000000000d1'$$), 'paid');
\endif
