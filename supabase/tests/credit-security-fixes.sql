-- Kiểm tra migration 20261101100000_credit_security_fixes.sql (review bảo mật hệ credit): C1 H1 H2 H3 M1 M2 M5 C2 L2.
--
-- Chạy trên Postgres 17 TẠM (không đụng stack Supabase đang chạy):
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -f - < supabase/tests/credit-security-fixes.sql | grep -E "PASS|FAIL|ERROR"
--   docker rm -f scratch-pg17
-- Mỗi ca in PASS hoặc dừng bằng FAIL. File chỉ chạy được MỘT lần trên mỗi DB.
-- scratch-stub.sql cho auth.users.email_confirmed_at mặc định now() (user "đã xác nhận"); ca chưa xác nhận insert null tường minh.
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
create or replace function t.txj(label text, amount bigint default -1000) returns text language sql as $$
  select jsonb_build_object('bank_name','OCB','amount',amount,'currency','VND','transaction_date','2026-10-30T10:00:00+07:00',
    'description','mo ta','raw_text','RAW '||label,'source_type','credit_card','account_ref','9586','merchant_name',null,'kind','normal')::text $$;
create or replace function t.ing(uid uuid, label text, refs text) returns text language sql as $$
  select t.val('service_role', null, format($q$select ingest_transaction(%L, %L::jsonb, %L::jsonb, 'test')::text$q$, uid, t.txj(label), refs)) $$;
-- Gọi resolve_unparsed_charged dưới service_role: trả sqlstate ('ok' nếu thành công).
create or replace function t.res(uid uuid, msg uuid, kind text, tx text default null) returns text language sql as $$
  select t.state('service_role', null, format($q$select resolve_unparsed_charged(%L, %L, %L, %L::jsonb)$q$, uid, msg, kind, tx)) $$;
-- Chạy 1 truy vấn trả 1 giá trị text với snapshot MỚI (subquery cùng câu SELECT với lời gọi ghi chỉ thấy dữ liệu trước khi ghi).
create or replace function t.q(sql text) returns text language plpgsql as $$
declare r text; begin execute sql into r; return r; end $$;
create or replace function t.bal(uid uuid) returns text language plpgsql as $$
declare r text; begin select balance::text into r from credit_balances where user_id = uid; return r; end $$;
create or replace function t.cnt(tbl text, uid uuid, extra text default 'true') returns text language plpgsql as $$
declare r text; begin
  execute format('select count(*)::text from %s where user_id = %L and (%s)', tbl, uid, extra) into r; return r; end $$;

\set P  '\'aaaaaaaa-0000-4000-a000-0000000000a1\'::uuid'
\set Q  '\'bbbbbbbb-0000-4000-a000-0000000000b2\'::uuid'
\set S  '\'55555555-0000-4000-a000-000000000005\'::uuid'
\set UL '\'77777777-0000-4000-a000-000000000007\'::uuid'
\set Z  '\'22222222-0000-4000-a000-000000000002\'::uuid'
\set CARD_P  '{"card_id":"aaaaaaaa-1111-4000-a000-0000000000a1"}'
\set CARD_Q  '{"card_id":"bbbbbbbb-1111-4000-a000-0000000000b2"}'
\set CARD_Z  '{"card_id":"22222222-1111-4000-a000-000000000002"}'
\set TX_P '{"amount":-5000,"transaction_date":"2026-10-30T10:00:00+07:00","description":"thu cong","card_id":"aaaaaaaa-1111-4000-a000-0000000000a1"}'

insert into auth.users(id) values (:P), (:Q), (:S), (:UL), (:Z);
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('aaaaaaaa-1111-4000-a000-0000000000a1',:P,'OCB','P','****9586','visa',5,25),
 ('bbbbbbbb-1111-4000-a000-0000000000b2',:Q,'OCB','Q','****9586','visa',5,25),
 ('55555555-1111-4000-a000-000000000005',:S,'OCB','S','****9586','visa',5,25),
 ('77777777-1111-4000-a000-000000000007',:UL,'OCB','UL','****9586','visa',5,25),
 ('22222222-1111-4000-a000-000000000002',:Z,'OCB','Z','****9586','visa',5,25);

-- ===== C1: authenticated không còn ghi được giao dịch
select t.check('C1: không còn policy own_tx_insert', (select count(*)::text from pg_policy
  where polrelid = 'public.transactions'::regclass and polname = 'own_tx_insert'), '0');
select t.check('C1: authenticated mất INSERT, vẫn SELECT/UPDATE/DELETE', (has_table_privilege('authenticated', 'public.transactions', 'INSERT')::text
  || has_table_privilege('authenticated', 'public.transactions', 'SELECT')::text
  || has_table_privilege('authenticated', 'public.transactions', 'UPDATE')::text
  || has_table_privilege('authenticated', 'public.transactions', 'DELETE')::text), 'falsetruetruetrue');
select t.check('C1: authenticated INSERT giao dịch vào thẻ của mình -> 42501, số dư không đổi', t.state('authenticated', :P,
  $$insert into transactions(user_id,bank_name,amount,transaction_date,card_id) values (auth.uid(),'X',-1,now(),'aaaaaaaa-1111-4000-a000-0000000000a1')$$)
  || t.cnt('transactions', :P) || t.bal(:P), '42501' || '0' || '100');
select t.check('C1: INSERT không gắn TK/thẻ cũng bị chặn; anon cũng vậy', t.state('authenticated', :P,
  $$insert into transactions(user_id,bank_name,amount,transaction_date) values (auth.uid(),'X',-1,now())$$)
  || t.state('anon', null, $$insert into transactions(user_id,bank_name,amount,transaction_date) values ('aaaaaaaa-0000-4000-a000-0000000000a1','X',-1,now())$$), '4250142501');
select t.check('L3: service_role có DELETE transactions + unparsed_messages tường minh', (has_table_privilege('service_role', 'public.transactions', 'DELETE')::text
  || has_table_privilege('service_role', 'public.unparsed_messages', 'DELETE')::text), 'truetrue');

-- ===== quyền hàm mới
select t.check('hàm cũ resolve_unparsed đã bị gỡ', coalesce(to_regprocedure('public.resolve_unparsed(uuid,text,jsonb)')::text, 'none'), 'none');
select t.check('hàm mới: INVOKER, chỉ service_role có EXECUTE', (select
  (count(*) = 3 and count(*) filter (where p.prosecdef
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or not has_function_privilege('service_role', p.oid, 'EXECUTE')) = 0)::text
  from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('resolve_unparsed_charged', 'discard_backfilled_tx', '_grant_welcome_credit')), 'true');
select t.check('authenticated không gọi resolve_unparsed_charged / discard_backfilled_tx', t.state('authenticated', :P,
  $$select resolve_unparsed_charged(auth.uid(), gen_random_uuid(), 'promo')$$)
  || t.state('authenticated', :P, $$select discard_backfilled_tx(auth.uid(), gen_random_uuid())$$), '4250142501');
select t.check('trigger auth.users: hàm security definer không ai gọi được như RPC', (select
  count(*) = 2 and count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or has_function_privilege('anon', p.oid, 'EXECUTE'))= 0
  from pg_proc p where p.proname in ('handle_new_user', 'handle_user_confirmed') and p.pronamespace = 'public'::regnamespace)::text, 'true');

-- ===== H1: phân loại thủ công TRỪ 1 credit
insert into unparsed_messages(id,user_id,raw_text,reason,suggested_kind) values
 ('aaaaaaaa-3333-4000-a000-000000000001',:P,'P msg 1','no_match','transaction'),
 ('aaaaaaaa-3333-4000-a000-000000000002',:P,'P msg 2','no_match','promo'),
 ('aaaaaaaa-3333-4000-a000-000000000003',:P,'P msg 3','no_match','card_reminder'),
 ('aaaaaaaa-3333-4000-a000-000000000004',:P,'P msg 4','no_match','transaction'),
 ('aaaaaaaa-3333-4000-a000-000000000005',:P,'P msg 5','no_match','transaction'),
 ('bbbbbbbb-3333-4000-a000-000000000001',:Q,'Q msg 1','no_match','transaction'),
 ('55555555-3333-4000-a000-000000000001',:S,'S msg 1','no_match','transaction'),
 ('77777777-3333-4000-a000-000000000001',:UL,'UL msg 1','no_match','transaction'),
 ('22222222-3333-4000-a000-000000000001',:Z,'Z msg 1','no_match','transaction'),
 ('22222222-3333-4000-a000-000000000002',:Z,'Z msg 2','no_match','promo');
select t.check('H1: resolve normal -> ok, số dư 100 -> 99', t.res(:P, 'aaaaaaaa-3333-4000-a000-000000000001', 'normal', :'TX_P') || t.bal(:P), 'ok99');
select t.check('... đúng 1 dòng usage -1, ref = id giao dịch vừa tạo, giao dịch của P', (select
  (count(*) = 1 and bool_and(l.delta = -1 and l.ref = u.transaction_id::text and x.user_id = :P and x.raw_text = 'P msg 1'))::text
  from credit_ledger l join unparsed_messages u on u.id = 'aaaaaaaa-3333-4000-a000-000000000001'
  join transactions x on x.id = u.transaction_id where l.kind = 'usage' and l.user_id = :P), 'true');
select t.check('... tin resolved + kind, resolve lần 2 -> 22023 và KHÔNG trừ thêm', (select (resolved and kind = 'normal')::text
  from unparsed_messages where id = 'aaaaaaaa-3333-4000-a000-000000000001')
  || t.res(:P, 'aaaaaaaa-3333-4000-a000-000000000001', 'normal', :'TX_P') || t.bal(:P), 'true' || '22023' || '99');
select t.check('promo + card_reminder miễn phí: không giao dịch, số dư giữ 99', t.res(:P, 'aaaaaaaa-3333-4000-a000-000000000002', 'promo')
  || t.res(:P, 'aaaaaaaa-3333-4000-a000-000000000003', 'card_reminder') || t.bal(:P) || t.cnt('transactions', :P), 'okok991');
select t.check('đầu vào sai (amount 0 / thiếu tx / ngày không offset / card lạ) -> 22023, không trừ, tin còn mở',
  t.res(:P, 'aaaaaaaa-3333-4000-a000-000000000004', 'normal', '{"amount":0,"transaction_date":"2026-10-30T10:00:00+07:00","card_id":"aaaaaaaa-1111-4000-a000-0000000000a1"}')
  || t.res(:P, 'aaaaaaaa-3333-4000-a000-000000000004', 'normal')
  || t.res(:P, 'aaaaaaaa-3333-4000-a000-000000000004', 'normal', '{"amount":-1,"transaction_date":"2026-10-30","card_id":"aaaaaaaa-1111-4000-a000-0000000000a1"}')
  || t.res(:P, 'aaaaaaaa-3333-4000-a000-000000000004', 'bogus')
  || t.bal(:P) || (select resolved::text from unparsed_messages where id = 'aaaaaaaa-3333-4000-a000-000000000004'), '22023' || '22023' || '22023' || '22023' || '99' || 'false');
select t.check('thẻ của người khác -> P0002, không trừ, tin còn mở', t.res(:P, 'aaaaaaaa-3333-4000-a000-000000000004', 'normal',
  '{"amount":-1000,"transaction_date":"2026-10-30T10:00:00+07:00","card_id":"bbbbbbbb-1111-4000-a000-0000000000b2"}') || t.bal(:P)
  || (select resolved::text from unparsed_messages where id = 'aaaaaaaa-3333-4000-a000-000000000004'), 'P0002' || '99' || 'false');
select t.check('tin của người khác -> P0002 (không trừ P, không đụng tin Q)', t.res(:P, 'bbbbbbbb-3333-4000-a000-000000000001', 'normal', :'TX_P')
  || t.bal(:P) || t.bal(:Q) || (select resolved::text from unparsed_messages where id = 'bbbbbbbb-3333-4000-a000-000000000001'), 'P0002' || '99' || '100' || 'false');
update user_settings set suspended_at = now() where user_id = :S;
select t.check('user bị khoá -> 42501 (cả tx lẫn promo), không giao dịch, không trừ', t.res(:S, '55555555-3333-4000-a000-000000000001', 'normal',
  '{"amount":-1000,"transaction_date":"2026-10-30T10:00:00+07:00","card_id":"55555555-1111-4000-a000-000000000005"}')
  || t.res(:S, '55555555-3333-4000-a000-000000000001', 'promo') || t.bal(:S) || t.cnt('transactions', :S), '4250142501' || '100' || '0');
update user_settings set suspended_at = null where user_id = :S;
select t.check('mở khoá -> resolve lại được, trừ 1', t.res(:S, '55555555-3333-4000-a000-000000000001', 'normal',
  '{"amount":-1000,"transaction_date":"2026-10-30T10:00:00+07:00","card_id":"55555555-1111-4000-a000-000000000005"}') || t.bal(:S), 'ok99');
update credit_balances set unlimited = true where user_id = :UL;   -- SQL của chủ app (không có đường client)
select t.check('unlimited: resolve ok, không trừ, không dòng usage', t.res(:UL, '77777777-3333-4000-a000-000000000001', 'normal',
  '{"amount":-1000,"transaction_date":"2026-10-30T10:00:00+07:00","card_id":"77777777-1111-4000-a000-000000000007"}') || t.bal(:UL), 'ok100');

select t.val('service_role', null, format($$select _apply_credit(%L, -100, 'adjust', 'drain:Z')::text$$, :Z));
select t.check('hết credit (số dư 0): normal -> 22003, không giao dịch, tin còn mở', t.res(:Z, '22222222-3333-4000-a000-000000000001', 'normal',
  '{"amount":-1000,"transaction_date":"2026-10-30T10:00:00+07:00","card_id":"22222222-1111-4000-a000-000000000002"}')
  || t.bal(:Z) || t.cnt('transactions', :Z) || (select resolved::text from unparsed_messages where id = '22222222-3333-4000-a000-000000000001'),
  '22003' || '0' || '0' || 'false');
select t.check('hết credit: promo vẫn miễn phí (không tạo giao dịch)', t.res(:Z, '22222222-3333-4000-a000-000000000002', 'promo') || t.bal(:Z), 'ok0');

-- tin no_credit: chỉ replay ghi được; resolve thủ công bị từ chối
insert into unparsed_messages(id,user_id,raw_text,reason,parsed_payload) values
 ('aaaaaaaa-3333-4000-a000-0000000000f1',:P,'held','no_credit', '{}');
select t.check('tin no_credit -> 22023 kể cả khi còn credit', t.res(:P, 'aaaaaaaa-3333-4000-a000-0000000000f1', 'promo')
  || t.res(:P, 'aaaaaaaa-3333-4000-a000-0000000000f1', 'normal', :'TX_P') || t.bal(:P), '22023' || '22023' || '99');

-- ===== M1: user không tự resolve tin no_credit bằng UPDATE trực tiếp
select t.check('M1: authenticated UPDATE resolved=true lên tin no_credit -> 22023', t.state('authenticated', :P,
  $$update unparsed_messages set resolved = true where id = 'aaaaaaaa-3333-4000-a000-0000000000f1'$$)
  || (select resolved::text from unparsed_messages where id = 'aaaaaaaa-3333-4000-a000-0000000000f1'), '22023' || 'false');
select t.check('M1: tin reason khác vẫn tự đánh dấu được (hành vi cũ)', t.state('authenticated', :P,
  $$update unparsed_messages set resolved = true, kind = 'promo' where id = 'aaaaaaaa-3333-4000-a000-000000000005'$$), 'ok');
select t.check('M1: service_role (replay) vẫn cập nhật được tin no_credit', t.state('service_role', null,
  $$update unparsed_messages set reason = 'no_account' where id = 'aaaaaaaa-3333-4000-a000-0000000000f1'$$), 'ok');
delete from unparsed_messages where id = 'aaaaaaaa-3333-4000-a000-0000000000f1';

-- ===== H2: credit chào mừng chỉ sau khi xác nhận email
\set N1 '\'c1000000-0000-4000-a000-000000000001\'::uuid'
\set N2 '\'c2000000-0000-4000-a000-000000000002\'::uuid'
\set N3 '\'c3000000-0000-4000-a000-000000000003\'::uuid'
insert into auth.users(id, email_confirmed_at) values (:N1, null);
select t.check('H2: đăng ký chưa xác nhận -> có ví số dư 0, KHÔNG dòng sổ cái, có user_settings', t.bal(:N1)
  || t.cnt('credit_ledger', :N1) || (select count(*)::text from user_settings where user_id = :N1), '001');
update auth.users set raw_user_meta_data = '{"x":1}' where id = :N1;
select t.check('H2: update cột khác không tặng', t.bal(:N1) || t.cnt('credit_ledger', :N1), '00');
update auth.users set email_confirmed_at = now() where id = :N1;
select t.check('H2: xác nhận (null -> có giá trị) -> 100 + đúng 1 dòng welcome:<id>', t.bal(:N1) || (select count(*)::text from credit_ledger
  where user_id = :N1 and kind = 'grant' and ref = 'welcome:' || :N1::text and delta = 100), '1001');
update auth.users set email_confirmed_at = null where id = :N1;
update auth.users set email_confirmed_at = now() where id = :N1;
select t.check('H2: xác nhận lại (null -> có giá trị lần 2) -> vẫn 100, vẫn 1 dòng sổ cái', t.bal(:N1) || t.cnt('credit_ledger', :N1), '1001');
update auth.users set email_confirmed_at = now() + interval '1 day' where id = :N1;
select t.check('H2: đổi mốc xác nhận (có -> có) không tặng thêm', t.bal(:N1) || t.cnt('credit_ledger', :N1), '1001');
insert into auth.users(id, email_confirmed_at) values (:N2, now());
select t.check('H2: tạo user đã xác nhận sẵn (vd OAuth / confirmations tắt) -> 100 ngay', t.bal(:N2) || t.cnt('credit_ledger', :N2), '1001');
-- đường tự chữa không tặng cho user chưa xác nhận
insert into auth.users(id, email_confirmed_at) values (:N3, null);
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('c3000000-1111-4000-a000-000000000003',:N3,'OCB','N3','****9586','visa',5,25);
delete from credit_balances where user_id = :N3;
select t.check('H2: ví bị thiếu + ingest (tự chữa) cho user chưa xác nhận -> tin bị giữ, không tặng',
  (t.ing(:N3, 'n3a', '{"card_id":"c3000000-1111-4000-a000-000000000003"}')::jsonb ->> 'status') || t.bal(:N3) || t.cnt('credit_ledger', :N3),
  'held' || '0' || '0');

-- ===== H3: dòng hỏng không chặn hàng đợi
\set H '\'dddddddd-0000-4000-a000-0000000000d4\'::uuid'
insert into auth.users(id) values (:H);
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('dddddddd-1111-4000-a000-0000000000d4',:H,'OCB','H','****9586','visa',5,25);
-- received_at tăng dần theo thứ tự p1..p6; p1,p2,p3,p5 hỏng, p4,p6 hợp lệ.
insert into unparsed_messages(id,user_id,raw_text,reason,received_at,parsed_payload) values
 ('dddddddd-3333-4000-a000-000000000001',:H,'p1 amount abc','no_credit','2026-10-30 01:00+00',
   jsonb_build_object('tx', t.txj('p1', 0)::jsonb || '{"amount":"abc"}', 'refs', '{"card_id":"dddddddd-1111-4000-a000-0000000000d4"}'::jsonb)),
 ('dddddddd-3333-4000-a000-000000000002',:H,'p2 date xau','no_credit','2026-10-30 02:00+00',
   jsonb_build_object('tx', t.txj('p2')::jsonb || '{"transaction_date":"khong-phai-ngay"}', 'refs', '{"card_id":"dddddddd-1111-4000-a000-0000000000d4"}'::jsonb)),
 ('dddddddd-3333-4000-a000-000000000003',:H,'p3 payload null','no_credit','2026-10-30 03:00+00', null),
 ('dddddddd-3333-4000-a000-000000000004',:H,'p4 hop le','no_credit','2026-10-30 04:00+00',
   jsonb_build_object('tx', t.txj('p4')::jsonb, 'refs', '{"card_id":"dddddddd-1111-4000-a000-0000000000d4"}'::jsonb)),
 ('dddddddd-3333-4000-a000-000000000005',:H,'p5 kind lạ','no_credit','2026-10-30 05:00+00',
   jsonb_build_object('tx', t.txj('p5')::jsonb || '{"kind":"bogus"}', 'refs', '{"card_id":"dddddddd-1111-4000-a000-0000000000d4"}'::jsonb)),
 ('dddddddd-3333-4000-a000-000000000006',:H,'p6 hop le','no_credit','2026-10-30 06:00+00',
   jsonb_build_object('tx', t.txj('p6')::jsonb, 'refs', '{"card_id":"dddddddd-1111-4000-a000-0000000000d4"}'::jsonb));
select t.check('H3: replay -> 2 (p4, p6), 98 credit, 2 giao dịch, 2 usage; không dòng hỏng nào làm cả hàng đợi dừng',
  t.val('service_role', null, format($$select replay_held_messages(%L)::text$$, :H)) || t.bal(:H) || t.cnt('transactions', :H)
  || t.cnt('credit_ledger', :H, $c$kind = 'usage'$c$), '2' || '98' || '2' || '2');
select t.check('H3: p1,p2,p3,p5 -> reason invalid_payload, chưa resolved, p4,p6 resolved', (select string_agg(left(raw_text, 2) || ':' || reason || ':' || resolved::text, ',' order by raw_text)
  from unparsed_messages where user_id = :H), 'p1:invalid_payload:false,p2:invalid_payload:false,p3:invalid_payload:false,p4:no_credit:true,p5:invalid_payload:false,p6:no_credit:true');
select t.check('H3: replay lần 2 -> 0 (dòng hỏng không bị thử lại, hàng đợi trống)', t.val('service_role', null,
  format($$select replay_held_messages(%L)::text$$, :H)), '0');
select t.check('H3: dòng hỏng hiện ở hộp tin của user (đọc được) và user phân loại thủ công được (trừ 1)', t.val('authenticated', :H,
  $$select count(*)::text from unparsed_messages where not resolved and reason = 'invalid_payload'$$)
  || t.res(:H, 'dddddddd-3333-4000-a000-000000000001', 'normal', '{"amount":-1000,"transaction_date":"2026-10-30T10:00:00+07:00","card_id":"dddddddd-1111-4000-a000-0000000000d4"}')
  || t.bal(:H), '4' || 'ok' || '97');

-- ===== M2: tin mới không chen trước tin treo
\set O '\'eeeeeeee-0000-4000-a000-0000000000e5\'::uuid'
insert into auth.users(id) values (:O);
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('eeeeeeee-1111-4000-a000-0000000000e5',:O,'OCB','O','****9586','visa',5,25);
select t.val('service_role', null, format($$select _apply_credit(%L, -100, 'adjust', 'drain:O')::text$$, :O));
-- Mỗi tin một câu lệnh riêng = một transaction riêng (cùng câu thì received_at = now() trùng, thứ tự FIFO không xác định).
select t.check('M2: tin treo h1 khi hết credit', (t.ing(:O, 'h1', '{"card_id":"eeeeeeee-1111-4000-a000-0000000000e5"}')::jsonb ->> 'status'), 'held');
select t.check('M2: tin treo h2 (mới hơn h1)', (t.ing(:O, 'h2', '{"card_id":"eeeeeeee-1111-4000-a000-0000000000e5"}')::jsonb ->> 'status'), 'held');
select t.val('service_role', null, format($$select _apply_credit(%L, 1, 'purchase', 'order:O')::text$$, :O));   -- nạp 1, KHÔNG replay
select t.check('M2: có 1 credit, tin mới n1 đến: tin treo h1 được ghi TRƯỚC, n1 bị giữ (không chen hàng)',
  (t.ing(:O, 'n1', '{"card_id":"eeeeeeee-1111-4000-a000-0000000000e5"}')::jsonb ->> 'status') || t.bal(:O)
  || t.q(format($$select string_agg(raw_text, ',' order by raw_text) from transactions where user_id = %L$$, :O))
  || t.q(format($$select string_agg(left(raw_text, 6) || resolved::text, ',' order by raw_text) from unparsed_messages where user_id = %L$$, :O)),
  'held' || '0' || 'RAW h1' || 'RAW h1true,RAW h2false,RAW n1false');

-- ===== C2: admin cộng credit -> phát lại tin treo
\set R  '\'f1000000-0000-4000-a000-0000000000f1\'::uuid'
\set R2 '\'f2000000-0000-4000-a000-0000000000f2\'::uuid'
\set V  '\'f3000000-0000-4000-a000-0000000000f3\'::uuid'
\set ADM '\'99999999-0000-4000-a000-000000000009\'::uuid'
insert into auth.users(id) values (:R), (:R2), (:V), (:ADM);
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('f1000000-1111-4000-a000-0000000000f1',:R,'OCB','R','****9586','visa',5,25),
 ('f2000000-1111-4000-a000-0000000000f2',:R2,'OCB','R2','****9586','visa',5,25);
select t.val('service_role', null, format($$select _apply_credit(%L, -100, 'adjust', 'drain:R')::text$$, :R));
select t.val('service_role', null, format($$select _apply_credit(%L, -100, 'adjust', 'drain:R2')::text$$, :R2));
select t.check('C2: R có tin treo r1', (t.ing(:R, 'r1', '{"card_id":"f1000000-1111-4000-a000-0000000000f1"}')::jsonb ->> 'status'), 'held');
select t.check('C2: R có tin treo r2', (t.ing(:R, 'r2', '{"card_id":"f1000000-1111-4000-a000-0000000000f1"}')::jsonb ->> 'status'), 'held');
select t.check('C2: R có tin treo r3', (t.ing(:R, 'r3', '{"card_id":"f1000000-1111-4000-a000-0000000000f1"}')::jsonb ->> 'status'), 'held');
select t.check('C2: admin cộng +2 -> trả số dư SAU replay (0), r1 + r2 đã ghi, r3 còn treo', t.val('service_role', null,
  format($$select admin_adjust_credit(%L, %L, 2, 'tang credit de xu ly tin treo')::text$$, :ADM, :R))
  || t.q(format($$select string_agg(left(raw_text, 6) || resolved::text, ',' order by raw_text) from unparsed_messages where user_id = %L$$, :R))
  || t.cnt('transactions', :R), '0' || 'RAW r1true,RAW r2true,RAW r3false' || '2');
select t.check('C2: admin TRỪ không phát lại (r3 còn treo, số dư 0 -> trừ bị chặn 22003)', t.state('service_role', null,
  format($$select admin_adjust_credit(%L, %L, -1, 'tru thu')$$, :ADM, :R)), '22003');
-- replay ném lỗi ngoài dự kiến (trigger giả) không được rollback điều chỉnh
select t.check('C2: R2 có 1 tin treo "boom"', (t.ing(:R2, 'boom', '{"card_id":"f2000000-1111-4000-a000-0000000000f2"}')::jsonb ->> 'status'), 'held');
create function public.t_boom() returns trigger language plpgsql as $$
begin if new.raw_text = 'RAW boom' then raise exception 'boom' using errcode = 'XX000'; end if; return new; end $$;
create trigger t_boom before insert on public.transactions for each row execute function public.t_boom();
select t.check('C2: replay lỗi (XX000) -> điều chỉnh VẪN áp: số dư 5, 1 dòng adjust, 1 audit; tin còn treo',
  t.val('service_role', null, format($$select admin_adjust_credit(%L, %L, 5, 'nap thu cong co replay loi')::text$$, :ADM, :R2))
  || t.cnt('credit_ledger', :R2, $c$kind = 'adjust' and delta = 5$c$)
  || t.q(format($$select count(*)::text from admin_audit_log where target_user_id = %L and action = 'adjust_credit'$$, :R2))
  || t.q(format($$select resolved::text from unparsed_messages where user_id = %L$$, :R2)) || t.cnt('transactions', :R2), '5' || '1' || '1' || 'false' || '0');
drop trigger t_boom on public.transactions;
drop function public.t_boom();
-- L2: tràn int4 không còn bị gắn nhầm "hết credit"
update credit_balances set balance = 2147483000 where user_id = :V;
select t.check('L2: cộng vượt int4 -> 22023 (không phải 22003), số dư + sổ cái + audit không đổi', t.state('service_role', null,
  format($$select admin_adjust_credit(%L, %L, 1000, 'cong vuot tran int4')$$, :ADM, :V)) || t.bal(:V)
  || t.q(format($$select count(*)::text from admin_audit_log where target_user_id = %L$$, :V)), '22023' || '2147483000' || '0');
select t.check('L2: cộng đúng tới trần int4 vẫn được', t.val('service_role', null,
  format($$select admin_adjust_credit(%L, %L, 647, 'cong sat tran int4')::text$$, :ADM, :V)), '2147483647');

-- ===== M5: discard_backfilled_tx nguyên tử + idempotent
\set D '\'a5000000-0000-4000-a000-0000000000a5\'::uuid'
insert into auth.users(id) values (:D);
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('a5000000-1111-4000-a000-0000000000a5',:D,'OCB','D','****9586','visa',5,25);
select (t.ing(:D, 'bf1', '{"card_id":"a5000000-1111-4000-a000-0000000000a5"}')::jsonb ->> 'id') as bf_tx \gset
select t.check('M5: ingest trừ 1 -> 99', t.bal(:D), '99');
select t.check('M5: discard -> true, giao dịch mất, hoàn credit 100, có dòng refund ref = id giao dịch', t.val('service_role', null,
  format($$select discard_backfilled_tx(%L, %L)::text$$, :D, :'bf_tx')) || t.cnt('transactions', :D) || t.bal(:D)
  || t.cnt('credit_ledger', :D, format($c$kind = 'refund' and ref = %L and delta = 1$c$, :'bf_tx')), 'true' || '0' || '100' || '1');
select t.check('M5: chạy lại -> false, không hoàn lần 2 (số dư 100, 1 dòng refund)', t.val('service_role', null,
  format($$select discard_backfilled_tx(%L, %L)::text$$, :D, :'bf_tx')) || t.bal(:D)
  || t.cnt('credit_ledger', :D, $c$kind = 'refund'$c$), 'false' || '100' || '1');
select (t.ing(:D, 'bf2', '{"card_id":"a5000000-1111-4000-a000-0000000000a5"}')::jsonb ->> 'id') as bf_tx2 \gset
select t.check('M5: p_user sai (user khác) -> false, giao dịch + credit của D không bị đụng', t.val('service_role', null,
  format($$select discard_backfilled_tx(%L, %L)::text$$, :Q, :'bf_tx2')) || t.cnt('transactions', :D) || t.bal(:D), 'false' || '1' || '99');
select (t.ing(:UL, 'bf3', '{"card_id":"77777777-1111-4000-a000-000000000007"}')::jsonb ->> 'id') as bf_tx3 \gset
select t.check('M5: unlimited không có dòng usage -> discard không hoàn (false), giao dịch vẫn xoá', t.val('service_role', null,
  format($$select discard_backfilled_tx(%L, %L)::text$$, :UL, :'bf_tx3'))
  || t.q(format($$select count(*)::text from transactions where id = %L$$, :'bf_tx3')) || t.cnt('credit_ledger', :UL, $c$kind = 'refund'$c$), 'false' || '0' || '0');
