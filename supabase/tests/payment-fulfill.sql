-- Kiểm tra fulfill_order (migration 20261031100000): idempotent, lệch tiền, quá hạn, trả 2 lần, phát lại tin treo,
-- và TRANH CHẤP (2+ session song song cùng IPN). 3 giai đoạn: stage=seq (tuần tự, 1 lần), stage=setup → session song
-- song → stage=assert.
--
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -v stage=seq -f - < supabase/tests/payment-fulfill.sql | grep -E "PASS|FAIL|ERROR"
--   $P -v stage=setup -f - < supabase/tests/payment-fulfill.sql
--   # 2 IPN cùng tx_id song song, 3 IPN khác tx_id cùng đơn song song (chỉ 1 được paid), 4 session áp song song
--   R=$($P -At -c "select provider_order_ref from payment_orders where user_id='cccccccc-0000-4000-a000-0000000000c1'")
--   for i in 1 2 3 4; do $P -c "select fulfill_order('momo','$R','TXC',50000)" & done; wait
--   R2=$($P -At -c "select provider_order_ref from payment_orders where user_id='cccccccc-0000-4000-a000-0000000000c2'")
--   for i in 1 2 3 4; do $P -c "select fulfill_order('zalopay','$R2','TXD$i',100000)" & done; wait
--   $P -v stage=assert -f - < supabase/tests/payment-fulfill.sql | grep -E "PASS|FAIL|ERROR"
--   docker rm -f scratch-pg17
-- Session song song chạy bằng postgres (superuser) — kiểm LOGIC khoá/idempotency; quyền đã kiểm ở payment-orders-rls.sql.
\set ON_ERROR_STOP on
create schema if not exists t;
create or replace function t.check(label text, got text, want text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: want [%] got [%]', label, want, got; end if;
  raise notice 'PASS %', label;
end $$;
-- Tạo đơn (service_role) rồi trả provider_order_ref của đơn đó.
create or replace function t.order_ref(uid uuid, prov text, pkg text) returns text language plpgsql as $$
declare r text;
begin select provider_order_ref into r from create_payment_order(uid, prov, pkg); return r; end $$;
create or replace function t.bal(uid uuid) returns text language plpgsql as $$
declare r text; begin select balance::text into r from credit_balances where user_id = uid; return r; end $$;
create or replace function t.n(q text) returns text language plpgsql as $$
declare r text; begin execute q into r; return r; end $$;
create or replace function t.sqlstate(stmt text) returns text language plpgsql as $$
declare got text := 'ok';
begin begin execute stmt; exception when others then got := sqlstate; end; return got; end $$;
create or replace function t.ful(prov text, ref text, tx text, amt bigint) returns text language plpgsql as $$
begin return fulfill_order(prov, ref, tx, amt); end $$;
create or replace function t.st(ref text) returns text language plpgsql as $$
declare r text; begin select status into r from payment_orders where provider_order_ref = ref; return r; end $$;

select :'stage' = 'seq' as is_seq, :'stage' = 'setup' as is_setup, :'stage' = 'assert' as is_assert \gset
\if :is_seq
  \set A '\'aaaaaaaa-0000-4000-a000-0000000000a1\'::uuid'
  \set B '\'aaaaaaaa-0000-4000-a000-0000000000a2\'::uuid'
  insert into auth.users values (:A, null), (:B, null);
  -- welcome 100 credit. Gói p50k = +500.
  create table t.refs as select
    t.order_ref(:A, 'momo', 'p50k') as r1, t.order_ref(:A, 'momo', 'p100k') as r2, t.order_ref(:A, 'zalopay', 'p50k') as r3,
    t.order_ref(:A, 'momo', 'p200k') as r4, t.order_ref(:A, 'momo', 'p50k') as r5;
  select t.check('unknown_order', t.ful('momo', 'khong-co', 'T0', 50000), 'unknown_order');
  select t.check('thiếu tx -> 22023', t.sqlstate($$select fulfill_order('momo', 'x', null, 1)$$), '22023');

  -- 1. đúng tiền -> paid, +500, 1 dòng sổ cái purchase ref = order.id
  select t.check('paid: trả về paid', t.ful('momo', (select r1 from t.refs), 'T1', 50000), 'paid');
  select t.check('paid: số dư 100 + 500', t.bal(:A), '600');
  select t.check('paid: status paid + paid_at + provider_tx_id', (select (status = 'paid' and paid_at is not null and provider_tx_id = 'T1')::text
    from payment_orders where provider_order_ref = (select r1 from t.refs)), 'true');
  select t.check('paid: sổ cái purchase ref = order.id, delta 500', (select (count(*) = 1 and min(delta) = 500)::text from credit_ledger l
    join payment_orders o on o.id::text = l.ref where l.kind = 'purchase' and o.provider_order_ref = (select r1 from t.refs)), 'true');
  -- 2. IPN lặp cùng tx_id -> duplicate, không cộng lần 2
  select t.check('IPN lặp: duplicate', t.ful('momo', (select r1 from t.refs), 'T1', 50000), 'duplicate');
  select t.check('IPN lặp: số dư vẫn 600', t.bal(:A), '600');
  -- 3. cùng tx_id nhưng provider khác không đụng nhau (unique theo cặp)
  select t.check('cùng tx_id khác provider là giao dịch khác', t.ful('zalopay', (select r3 from t.refs), 'T1', 50000), 'paid');
  select t.check('số dư 1100', t.bal(:A), '1100');
  -- 4. đơn đã paid, tx_id KHÁC (trả 2 lần) -> mismatch, KHÔNG cộng, đơn vẫn paid
  select t.check('trả 2 lần: mismatch', t.ful('momo', (select r1 from t.refs), 'T1b', 50000), 'mismatch');
  select t.check('trả 2 lần: không cộng, đơn vẫn paid', t.bal(:A) || '|' || t.st((select r1 from t.refs)), '1100|paid');
  -- 5. lệch tiền (thiếu / thừa) -> mismatch không cộng, lưu tx_id
  select t.check('lệch tiền (thiếu): mismatch', t.ful('momo', (select r2 from t.refs), 'T2', 99999), 'mismatch');
  select t.check('lệch tiền: không cộng, status mismatch, lưu tx_id', t.bal(:A) || '|' || t.st((select r2 from t.refs))
    || '|' || (select provider_tx_id from payment_orders where provider_order_ref = (select r2 from t.refs)), '1100|mismatch|T2');
  select t.check('lệch tiền: IPN lặp cùng tx -> duplicate', t.ful('momo', (select r2 from t.refs), 'T2', 100000), 'duplicate');
  select t.check('đơn mismatch: IPN đúng tiền với tx khác vẫn không cộng', t.ful('momo', (select r2 from t.refs), 'T2c', 100000), 'mismatch');
  select t.check('  ... số dư vẫn 1100', t.bal(:A), '1100');
  select t.check('lệch tiền (thừa): mismatch', t.ful('momo', (select r4 from t.refs), 'T4', 200001), 'mismatch');
  -- 6. quá hạn -> mismatch
  update payment_orders set expires_at = now() - interval '1 second' where provider_order_ref = (select r5 from t.refs);
  select t.check('quá hạn: mismatch', t.ful('momo', (select r5 from t.refs), 'T5', 50000), 'mismatch');
  select t.check('quá hạn: không cộng', t.bal(:A), '1100');
  -- 7. đơn failed rồi IPN thành công muộn -> mismatch
  select t.check('fail_payment_order pending -> true', t.n(format($$select fail_payment_order('momo', %L, 'x')::text$$, t.order_ref(:A, 'momo', 'p50k'))), 'true');
  select t.check('fail_payment_order không đổi đơn đã paid', t.n(format($$select fail_payment_order('momo', %L, 'x')::text$$, (select r1 from t.refs))), 'false');
  -- 8. expire_stale_orders: chỉ đơn quá hạn VÀ đã hỏi sau hạn
  create table t.refs2 as select t.order_ref(:B, 'momo', 'p50k') as q1, t.order_ref(:B, 'momo', 'p50k') as q2, t.order_ref(:B, 'momo', 'p50k') as q3;
  update payment_orders set expires_at = now() - interval '2 minutes', last_checked_at = now() - interval '1 minute'
    where provider_order_ref = (select q1 from t.refs2);                    -- đã hỏi sau hạn
  update payment_orders set expires_at = now() - interval '2 minutes', last_checked_at = now() - interval '5 minutes'
    where provider_order_ref = (select q2 from t.refs2);                    -- hỏi lần cuối TRƯỚC hạn
  select t.check('expire_stale_orders: chỉ đếm 1', t.n('select expire_stale_orders()::text'), '1');
  select t.check('  q1 expired, q2 + q3 pending', t.st((select q1 from t.refs2)) || t.st((select q2 from t.refs2)) || t.st((select q3 from t.refs2)),
    'expiredpendingpending');
  -- 9. tin treo (hết credit) được phát lại khi nạp
  select _apply_credit(:B, -100, 'adjust', 'drain:b');
  select t.check('B hết credit', t.bal(:B), '0');
  insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date)
    values ('aaaaaaaa-1111-4000-a000-0000000000b2', :B, 'OCB', 'B', '****9586', 'visa', 5, 25);
  select ingest_transaction(:B, jsonb_build_object('bank_name','OCB','amount',-1000,'currency','VND','transaction_date','2026-10-30T10:00:00+07:00',
    'description','d','raw_text','RAW held1','source_type','credit_card','account_ref','9586','merchant_name',null,'kind','normal'),
    '{"card_id":"aaaaaaaa-1111-4000-a000-0000000000b2"}'::jsonb, 't');
  select t.check('1 tin treo no_credit', t.n(format($$select count(*)::text from unparsed_messages where user_id = %L and reason = 'no_credit' and not resolved$$, :B)), '1');
  select t.check('nạp -> paid', t.ful('momo', (select q3 from t.refs2), 'TB', 50000), 'paid');
  select t.check('replay: tin treo thành giao dịch, trừ 1 credit (500 - 1)', t.bal(:B) || '|' ||
    t.n(format($$select count(*)::text from transactions where user_id = %L$$, :B)) || '|' ||
    t.n(format($$select count(*)::text from unparsed_messages where user_id = %L and not resolved$$, :B)), '499|1|0');
  -- 10. replay ném lỗi KHÔNG lường trước -> credit đã nạp vẫn commit (replay chỉ là việc phụ).
  -- Tin dữ liệu hỏng (22xxx / 23xxx) giờ được replay tự bỏ qua (H3, xem credit-security-fixes.sql) nên không còn làm replay ném lỗi;
  -- ca này mô phỏng lỗi ngoài dự kiến bằng trigger giả ném XX000 khi ghi giao dịch của tin 'RAW broken'.
  insert into auth.users values ('aaaaaaaa-0000-4000-a000-0000000000a3', null);
  select _apply_credit('aaaaaaaa-0000-4000-a000-0000000000a3', -99, 'adjust', 'drain:c');
  insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date)
    values ('aaaaaaaa-1111-4000-a000-0000000000a3', 'aaaaaaaa-0000-4000-a000-0000000000a3', 'OCB', 'C', '****9586', 'visa', 5, 25);
  insert into unparsed_messages (user_id, raw_text, source, reason, parsed_payload)
    values ('aaaaaaaa-0000-4000-a000-0000000000a3', 'RAW broken', 't', 'no_credit',
      jsonb_build_object('tx', jsonb_build_object('bank_name','OCB','amount',-1000,'currency','VND','transaction_date','2026-10-30T10:00:00+07:00',
        'raw_text','RAW broken','source_type','credit_card','kind','normal'), 'refs', '{"card_id":"aaaaaaaa-1111-4000-a000-0000000000a3"}'::jsonb));
  create function public.t_boom() returns trigger language plpgsql as $f$
    begin if new.raw_text = 'RAW broken' then raise exception 'boom' using errcode = 'XX000'; end if; return new; end $f$;
  create trigger t_boom before insert on public.transactions for each row execute function public.t_boom();
  select t.check('replay thật sự ném lỗi (điều kiện của ca)', (t.sqlstate($$select replay_held_messages('aaaaaaaa-0000-4000-a000-0000000000a3')$$) <> 'ok' )::text, 'true');
  create table t.refs3 as select t.order_ref('aaaaaaaa-0000-4000-a000-0000000000a3', 'momo', 'p50k') as c1;
  select t.check('tin hỏng: fulfill vẫn paid', t.ful('momo', (select c1 from t.refs3), 'TC', 50000), 'paid');
  select t.check('tin hỏng: credit vẫn được cộng + đơn paid', t.bal('aaaaaaaa-0000-4000-a000-0000000000a3') || '|' || t.st((select c1 from t.refs3)), '501|paid');
  select t.check('bất biến: balance = sum(delta) mọi user', t.n($$select count(*)::text from credit_balances b
    where b.balance <> coalesce((select sum(delta) from credit_ledger l where l.user_id = b.user_id), 0)$$), '0');
  select t.check('số dòng purchase = số đơn paid', t.n($$select (select count(*) from credit_ledger where kind='purchase')::text || '|'
    || (select count(*) from payment_orders where status='paid')$$), '4|4');
\endif
\if :is_setup
  insert into auth.users values ('cccccccc-0000-4000-a000-0000000000c1', null), ('cccccccc-0000-4000-a000-0000000000c2', null);
  select t.order_ref('cccccccc-0000-4000-a000-0000000000c1', 'momo', 'p50k');
  select t.order_ref('cccccccc-0000-4000-a000-0000000000c2', 'zalopay', 'p100k');
\endif
\if :is_assert
  -- C: 4 IPN cùng tx_id song song -> đúng 1 paid (+500), không ghi 2 lần
  select t.check('song song cùng tx_id: số dư 100 + 500 = 600', t.bal('cccccccc-0000-4000-a000-0000000000c1'), '600');
  select t.check('song song cùng tx_id: đúng 1 dòng purchase', t.n($$select count(*)::text from credit_ledger
    where kind = 'purchase' and user_id = 'cccccccc-0000-4000-a000-0000000000c1'$$), '1');
  select t.check('song song cùng tx_id: đơn paid, tx_id TXC', t.n($$select status || provider_tx_id from payment_orders
    where user_id = 'cccccccc-0000-4000-a000-0000000000c1'$$), 'paidTXC');
  -- D: 4 IPN KHÁC tx_id cùng 1 đơn song song -> đúng 1 cộng (+1200), phần còn lại mismatch, đơn giữ paid
  select t.check('song song khác tx_id: số dư 100 + 1200 = 1300', t.bal('cccccccc-0000-4000-a000-0000000000c2'), '1300');
  select t.check('song song khác tx_id: đúng 1 dòng purchase, đơn paid', t.n($$select (select count(*) from credit_ledger
    where kind = 'purchase' and user_id = 'cccccccc-0000-4000-a000-0000000000c2')::text || (select status from payment_orders
    where user_id = 'cccccccc-0000-4000-a000-0000000000c2')$$), '1paid');
  select t.check('bất biến: balance = sum(delta) mọi user', t.n($$select count(*)::text from credit_balances b
    where b.balance <> coalesce((select sum(delta) from credit_ledger l where l.user_id = b.user_id), 0)$$), '0');
\endif
