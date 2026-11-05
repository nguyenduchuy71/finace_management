-- Kiểm tra RLS / grant / RPC của migration 20261030100000_credit_ledger.sql (2 user + user bị khoá + user unlimited).
--
-- Chạy trên Postgres 17 TẠM (giống admin-rls.sql), không đụng stack Supabase đang chạy:
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -f - < supabase/tests/credit-ledger-rls.sql | grep -E "PASS|FAIL|ERROR"
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
create or replace function t.msg(role_name text, uid uuid, stmt text) returns text language plpgsql as $$
declare got text := 'ok';
begin
  execute format('set local role %I', role_name);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  begin execute stmt; exception when others then got := sqlerrm; end;
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
-- Payload giao dịch parser (raw_text duy nhất theo nhãn) — dựng ở phía postgres vì service_role không dùng được schema t.
create or replace function t.txj(label text, amount bigint default -1000) returns text language sql as $$
  select jsonb_build_object('bank_name','OCB','amount',amount,'currency','VND','transaction_date','2026-10-30T10:00:00+07:00',
    'description','mo ta','raw_text','RAW '||label,'source_type','credit_card','account_ref','9586','merchant_name',null,'kind','normal')::text $$;
-- Gọi ingest_transaction dưới service_role, trả JSON text.
create or replace function t.ing(uid uuid, label text, refs text) returns text language sql as $$
  select t.val('service_role', null, format($q$select ingest_transaction(%L, %L::jsonb, %L::jsonb, 'test')::text$q$, uid, t.txj(label), refs)) $$;
-- plpgsql (volatile): mỗi lệnh bên trong lấy snapshot MỚI. Subquery nằm cùng câu SELECT với lời gọi ghi thì chỉ thấy
-- dữ liệu TRƯỚC khi ghi — đọc trạng thái sau hành động phải đi qua các hàm này.
create or replace function t.bal(uid uuid) returns text language plpgsql as $$
declare r text; begin select balance::text into r from credit_balances where user_id = uid; return r; end $$;
create or replace function t.cnt(tbl text, uid uuid, extra text default 'true') returns text language plpgsql as $$
declare r text; begin
  execute format('select count(*)::text from %s where user_id = %L and (%s)', tbl, uid, extra) into r; return r; end $$;

\set A '\'aaaaaaaa-0000-4000-a000-000000000001\'::uuid'
\set B '\'bbbbbbbb-0000-4000-a000-000000000002\'::uuid'
\set S '\'55555555-0000-4000-a000-000000000005\'::uuid'
\set U '\'77777777-0000-4000-a000-000000000007\'::uuid'
\set X '\'99999999-0000-4000-a000-000000000009\'::uuid'
\set CARD_A '{"card_id":"aaaaaaaa-1111-4000-a000-000000000001"}'
\set CARD_B '{"card_id":"bbbbbbbb-1111-4000-a000-000000000001"}'
\set CARD_U '{"card_id":"77777777-1111-4000-a000-000000000001"}'

-- ===== chào mừng khi đăng ký (trigger handle_new_user) đọc từ credit_settings
insert into auth.users values (:A, null), (:B, null), (:S, null), (:U, null), (:X, null);
select t.check('credit_settings seed 100', (select welcome_credits::text from credit_settings), '100');
select t.check('đăng ký -> số dư 100 + đúng 1 dòng sổ cái grant welcome:<id>', (select
  (b.balance = 100 and (select count(*) from credit_ledger l where l.user_id = :A) = 1
   and (select ref from credit_ledger l where l.user_id = :A and kind = 'grant') = 'welcome:' || :A::text)::text
  from credit_balances b where b.user_id = :A), 'true');
update credit_settings set welcome_credits = 0;
insert into auth.users values ('00000000-0000-4000-a000-0000000000f0', null);
select t.check('welcome_credits = 0 -> có ví, số dư 0, KHÔNG có dòng sổ cái delta 0', (select
  (b.balance = 0 and (select count(*) from credit_ledger l where l.user_id = b.user_id) = 0)::text
  from credit_balances b where b.user_id = '00000000-0000-4000-a000-0000000000f0'), 'true');
update credit_settings set welcome_credits = 100;
delete from auth.users where id = '00000000-0000-4000-a000-0000000000f0';
select t.check('_ensure_credit_account chạy lại: không tặng lần 2', (select
  (t.val('service_role', null, format($$select _ensure_credit_account(%L)::text$$, :A)) is not null
   and balance = 100)::text from credit_balances where user_id = :A), 'true');

insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('aaaaaaaa-1111-4000-a000-000000000001',:A,'OCB','A','****9586','visa',5,25),
 ('bbbbbbbb-1111-4000-a000-000000000001',:B,'OCB','B','****9586','visa',5,25),
 ('bbbbbbbb-1111-4000-a000-000000000002',:B,'OCB','B2','****1111','visa',5,25),
 ('77777777-1111-4000-a000-000000000001',:U,'OCB','U','****9586','visa',5,25);

-- ===== quyền: user chỉ ĐỌC; không ghi, không gọi hàm ghi
select t.check('A chỉ thấy dòng sổ cái + số dư của mình', t.val('authenticated', :A,
  $$select (select count(*) from credit_ledger) || '|' || (select count(*) from credit_balances) || '|' || (select balance from credit_balances)$$), '1|1|100');
select t.check('B không đọc được sổ cái / số dư của A', t.val('authenticated', :B,
  $$select ((select count(*) from credit_ledger where user_id = 'aaaaaaaa-0000-4000-a000-000000000001')
          + (select count(*) from credit_balances where user_id = 'aaaaaaaa-0000-4000-a000-000000000001'))::text$$), '0');
select t.check('authenticated không insert sổ cái', t.state('authenticated', :A,
  $$insert into credit_ledger(user_id,delta,kind,ref) values (auth.uid(), 1000, 'grant', 'tu cap')$$), '42501');
select t.check('authenticated không update số dư', t.state('authenticated', :A, $$update credit_balances set balance = 999999$$), '42501');
select t.check('authenticated không tự bật unlimited', t.state('authenticated', :A, $$update credit_balances set unlimited = true$$), '42501');
select t.check('authenticated không insert / delete số dư', t.state('authenticated', :A,
  $$insert into credit_balances(user_id, balance) values (auth.uid(), 5)$$) || t.state('authenticated', :A, $$delete from credit_balances$$), '4250142501');
select t.check('authenticated không update / delete sổ cái', t.state('authenticated', :A, $$update credit_ledger set delta = 5000$$)
  || t.state('authenticated', :A, $$delete from credit_ledger$$), '4250142501');
select t.check('authenticated không đọc credit_settings', t.state('authenticated', :A, $$select * from credit_settings$$), '42501');
select t.check('authenticated không sửa credit_settings', t.state('authenticated', :A, $$update credit_settings set welcome_credits = 99999$$), '42501');
select t.check('anon không đọc sổ cái', t.state('anon', null, $$select * from credit_ledger$$), '42501');
select t.check('unlimited của A vẫn đọc được (UI hiện "Không giới hạn")', t.val('authenticated', :A, $$select unlimited::text from credit_balances$$), 'false');

select t.check('authenticated không gọi ingest_transaction', t.state('authenticated', :A, format(
  $$select ingest_transaction(auth.uid(), %L::jsonb, '{"card_id":"aaaaaaaa-1111-4000-a000-000000000001"}', 'x')$$, t.txj('hack'))), '42501');
select t.check('authenticated không gọi replay_held_messages', t.state('authenticated', :A, $$select replay_held_messages(auth.uid())$$), '42501');
select t.check('authenticated không gọi _apply_credit', t.state('authenticated', :A, $$select _apply_credit(auth.uid(), 1000, 'grant', 'hack')$$), '42501');
select t.check('authenticated không gọi _ensure_credit_account / _insert_parsed_tx', t.state('authenticated', :A,
  $$select _ensure_credit_account(auth.uid())$$) || t.state('authenticated', :A,
  format($$select _insert_parsed_tx(auth.uid(), %L::jsonb, '{"card_id":"aaaaaaaa-1111-4000-a000-000000000001"}')$$, t.txj('hack2'))), '4250142501');
select t.check('authenticated không gọi admin_adjust_credit', t.state('authenticated', :A,
  $$select admin_adjust_credit(auth.uid(), auth.uid(), 1000, 'tu cap credit')$$), '42501');
select t.check('authenticated không gọi admin_user_ledger', t.state('authenticated', :A, $$select * from admin_user_ledger(auth.uid())$$), '42501');
select t.check('anon không gọi ingest_transaction / admin_adjust_credit', t.state('anon', null,
  $$select ingest_transaction('aaaaaaaa-0000-4000-a000-000000000001', '{}', '{}', 'x')$$)
  || t.state('anon', null, $$select admin_adjust_credit(null, null, 1, 'abcde')$$), '4250142501');
select t.check('hàm credit: INVOKER, chỉ service_role có EXECUTE', (select
  (count(*) = 8 and count(*) filter (where p.prosecdef
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or not has_function_privilege('service_role', p.oid, 'EXECUTE')) = 0)::text
  from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('_apply_credit','_ensure_credit_account','_insert_parsed_tx','ingest_transaction',
                      'replay_held_messages','admin_adjust_credit','admin_user_ledger','credit_ledger_immutable')), 'true');
select t.check('2 bảng mới có policy restrictive not_suspended', (select count(*)::text from pg_policy
  where polname = 'not_suspended' and polrelid in ('public.credit_ledger'::regclass, 'public.credit_balances'::regclass)
    and not polpermissive), '2');

-- ===== sổ cái append-only
grant update, delete on public.credit_ledger to service_role;   -- để thử trigger là lớp chặn thật (thu hồi ngay sau)
select t.check('trigger chặn UPDATE sổ cái dù service_role có quyền', t.msg('service_role', null, $$update credit_ledger set delta = 5000$$), 'credit_ledger là append-only');
revoke update, delete on public.credit_ledger from service_role;
select t.check('trigger chặn TRUNCATE sổ cái', t.msg('postgres', null, $$truncate credit_ledger$$), 'credit_ledger là append-only');
select t.check('delta = 0 bị chặn (23514)', t.state('service_role', null, format($$select _apply_credit(%L, 0, 'adjust', 'zero')$$, :A)), '23514');
select t.check('kind lạ bị chặn (23514)', t.state('service_role', null, format($$select _apply_credit(%L, 1, 'free', 'x')$$, :A)), '23514');

-- ===== idempotency + CHECK balance >= 0
select t.check('_apply_credit lần 1 = true, lần 2 cùng ref = false', t.val('service_role', null,
  format($$select _apply_credit(%L, 5, 'grant', 'dup:1')::text$$, :A)) || t.val('service_role', null,
  format($$select _apply_credit(%L, 5, 'grant', 'dup:1')::text$$, :A)), 'truefalse');
select t.check('... số dư chỉ cộng 1 lần (105)', t.bal(:A), '105');
select t.check('trừ quá số dư -> 23514', t.state('service_role', null, format($$select _apply_credit(%L, -200, 'adjust', 'over')$$, :A)), '23514');
select t.check('... rollback cả dòng sổ cái (số dư 105, không có dòng over)', t.bal(:A) || (select count(*)::text from credit_ledger where ref = 'over'), '1050');
select t.check('user không tồn tại (không có ví) -> FK 23503', t.state('service_role', null,
  $$select _apply_credit('cccccccc-0000-4000-a000-0000000000cc', 1, 'grant', 'nobody')$$), '23503');

-- ===== ingest: ghi + trừ 1 credit nguyên tử
select t.check('ingest (A, 105 credit) -> inserted', (t.ing(:A, 'a1', :'CARD_A')::jsonb ->> 'status'), 'inserted');
select t.check('... trừ 1 (104), 1 giao dịch, dòng usage ref = id giao dịch', (select
  (t.bal(:A) = '104' and (select count(*) from transactions where user_id = :A) = 1
   and exists (select 1 from credit_ledger l join transactions x on x.id::text = l.ref
               where l.kind = 'usage' and l.delta = -1 and l.user_id = :A))::text), 'true');
select t.check('TK/thẻ của người khác -> P0002, không trừ, không ghi', t.state('service_role', null, format(
  $$select ingest_transaction(%L, %L::jsonb, %L::jsonb, 'x')$$, :A, t.txj('steal'), :'CARD_B')) || t.bal(:A) ||
  t.cnt('transactions', :A), 'P0002' || '104' || '1');
select t.check('thiếu cả account_id lẫn card_id -> 22023', t.state('service_role', null, format(
  $$select ingest_transaction(%L, %L::jsonb, '{}', 'x')$$, :A, t.txj('norefs'))), '22023');

-- ===== hết credit: giữ tin, KHÔNG mất
select t.check('rút B về 0', t.val('service_role', null, format($$select _apply_credit(%L, -100, 'adjust', 'drain:B')::text$$, :B)), 'true');
select t.check('ingest khi 0 credit -> held, chưa có giao dịch', (t.ing(:B, 'b1', :'CARD_B')::jsonb ->> 'status')
  || t.cnt('transactions', :B), 'held0');
select t.check('tin treo: reason no_credit, chưa resolved, payload có tx + refs', (select
  (reason = 'no_credit' and not resolved and raw_text = 'RAW b1' and source = 'test'
   and parsed_payload #>> '{tx,amount}' = '-1000' and parsed_payload #>> '{refs,card_id}' = 'bbbbbbbb-1111-4000-a000-000000000001')::text
  from unparsed_messages where user_id = :B), 'true');
select t.check('B đọc được tin treo của mình, A không thấy', t.val('authenticated', :B, $$select count(*)::text from unparsed_messages$$)
  || t.val('authenticated', :A, $$select count(*)::text from unparsed_messages$$), '10');
-- H1: resolve_unparsed (authenticated, miễn phí) đã bị gỡ; phân loại thủ công = resolve_unparsed_charged (service_role, trừ 1 credit).
select t.check('resolve_unparsed_charged tin no_credit -> 22023 (chờ nạp), không ghi giao dịch', t.state('service_role', null, format(
  $$select resolve_unparsed_charged(%L, %L, 'normal', '{"amount":-1000,"transaction_date":"2026-10-30T10:00:00+07:00","card_id":"bbbbbbbb-1111-4000-a000-000000000001"}')$$,
  :B, (select id from unparsed_messages where user_id = :B))) || t.cnt('transactions', :B), '220230');
select t.check('... kể cả gắn nhãn promo cũng bị từ chối', t.state('service_role', null, format(
  $$select resolve_unparsed_charged(%L, %L, 'promo')$$, :B, (select id from unparsed_messages where user_id = :B))), '22023');
-- tin thường + hết credit (số dư 0) -> 22003, không ghi gì; tin promo thì miễn phí dù số dư 0
insert into unparsed_messages(user_id, raw_text, reason) values (:B, 'TIN BINH THUONG', 'no_match');
select t.check('tin no_match, số dư 0 -> 22003 (hết credit), không giao dịch, không đụng sổ cái', t.state('service_role', null, format(
  $$select resolve_unparsed_charged(%L, %L, 'normal', '{"amount":-2000,"transaction_date":"2026-10-30T10:00:00+07:00","card_id":"bbbbbbbb-1111-4000-a000-000000000001"}')$$,
  :B, (select id from unparsed_messages where user_id = :B and raw_text = 'TIN BINH THUONG')))
  || t.bal(:B) || t.cnt('transactions', :B) || t.cnt('credit_ledger', :B, $c$kind = 'usage'$c$), '22003000');
delete from unparsed_messages where raw_text = 'TIN BINH THUONG';
delete from transactions where user_id = :B;   -- dọn để các ca replay đếm gọn
update unparsed_messages set resolved = false, transaction_id = null where false;

-- trần 300 tin treo/user
insert into unparsed_messages(user_id, raw_text, reason, parsed_payload)
  select :B, 'FILL ' || g, 'no_credit', '{}' from generate_series(1, 299) g;
select t.check('đủ 300 tin treo -> held_full, không thêm dòng', (t.ing(:B, 'b2', :'CARD_B')::jsonb ->> 'status')
  || t.cnt('unparsed_messages', :B, $c$reason = 'no_credit'$c$), 'held_full300');
delete from unparsed_messages where raw_text like 'FILL %';

-- ===== replay FIFO
-- Mỗi tin một câu lệnh riêng = một transaction riêng (như thật): cùng câu thì received_at = now() trùng, thứ tự FIFO không xác định.
select t.check('tin treo b3', t.ing(:B, 'b3', :'CARD_B')::jsonb ->> 'status', 'held');
select t.check('tin treo b4 (mới hơn b3)', t.ing(:B, 'b4', :'CARD_B')::jsonb ->> 'status', 'held');
select t.check('replay khi 0 credit -> 0, không đổi gì', t.val('service_role', null, format($$select replay_held_messages(%L)::text$$, :B))
  || t.cnt('transactions', :B), '00');
select t.check('nạp 2 credit', t.val('service_role', null, format($$select _apply_credit(%L, 2, 'purchase', 'order:1')::text$$, :B)), 'true');
select t.check('replay -> 2, số dư 0, 2 usage', t.val('service_role', null, format($$select replay_held_messages(%L)::text$$, :B)) || t.bal(:B)
  || t.cnt('credit_ledger', :B, $c$kind = 'usage'$c$), '202');
select t.check('FIFO: b1, b3 đã ghi; b4 (mới nhất) còn treo', (select string_agg(raw_text || ':' || resolved::text, ',' order by raw_text)
  from unparsed_messages where user_id = :B and raw_text like 'RAW b%'), 'RAW b1:true,RAW b3:true,RAW b4:false');
select t.check('tin đã replay: kind + transaction_id đúng, giao dịch có raw_text gốc', (select
  (u.kind = 'normal' and u.transaction_id = x.id and x.raw_text = 'RAW b1' and x.card_id = 'bbbbbbbb-1111-4000-a000-000000000001')::text
  from unparsed_messages u join transactions x on x.id = u.transaction_id where u.raw_text = 'RAW b1'), 'true');
select t.check('replay lần 2 khi hết credit -> 0 (không ghi trùng)', t.val('service_role', null, format($$select replay_held_messages(%L)::text$$, :B)), '0');

-- thẻ bị xoá trong lúc treo -> no_account, không trừ credit, tin sau vẫn được replay
select t.check('treo b5 (thẻ 2)', t.ing(:B, 'b5', '{"card_id":"bbbbbbbb-1111-4000-a000-000000000002"}')::jsonb ->> 'status', 'held');
select t.check('treo b6 (thẻ 1)', t.ing(:B, 'b6', :'CARD_B')::jsonb ->> 'status', 'held');
delete from credit_cards where id = 'bbbbbbbb-1111-4000-a000-000000000002';
select t.check('nạp 2 credit (order:2)', t.val('service_role', null, format($$select _apply_credit(%L, 2, 'purchase', 'order:2')::text$$, :B)), 'true');
select t.check('replay: thẻ đã xoá -> no_account (không trừ), tin b4 + b6 ghi; số dư 0', t.val('service_role', null,
  format($$select replay_held_messages(%L)::text$$, :B)) || t.bal(:B), '20');
select t.check('... b5 chuyển reason no_account, chưa resolved (user tự xử miễn phí)', (select (reason = 'no_account' and not resolved)::text
  from unparsed_messages where raw_text = 'RAW b5'), 'true');

-- ===== khoá: user bị khoá không đọc được số dư
update user_settings set suspended_at = now() where user_id = :S;
select t.check('S bị khoá: không đọc số dư / sổ cái', t.val('authenticated', :S,
  $$select ((select count(*) from credit_balances) + (select count(*) from credit_ledger))::text$$), '0');
select t.check('A (không khoá) vẫn đọc được', t.val('authenticated', :A, $$select count(*)::text from credit_balances$$), '1');

-- ===== unlimited: không trừ, không bao giờ giữ
select t.check('rút U về 0 rồi tạo 1 tin treo', t.val('service_role', null, format($$select _apply_credit(%L, -100, 'adjust', 'drain:U')::text$$, :U))
  || (t.ing(:U, 'u1', :'CARD_U')::jsonb ->> 'status'), 'trueheld');
update credit_balances set unlimited = true where user_id = :U;   -- SQL của chủ app (không có đường client)
select t.check('unlimited: ingest 3 tin -> cả 3 inserted, số dư vẫn 0', (t.ing(:U, 'u2', :'CARD_U')::jsonb ->> 'status')
  || (t.ing(:U, 'u3', :'CARD_U')::jsonb ->> 'status') || (t.ing(:U, 'u4', :'CARD_U')::jsonb ->> 'status') || t.bal(:U), 'insertedinsertedinserted0');
select t.check('... không có dòng usage nào (không ghi dòng delta 0)', t.cnt('credit_ledger', :U, $c$kind = 'usage'$c$), '0');
select t.check('... tin treo u1 đã được ingest(u2) phát lại TRƯỚC (M2): replay tay = 0, đủ 4 giao dịch, không trừ', t.val('service_role', null, format($$select replay_held_messages(%L)::text$$, :U))
  || t.bal(:U) || t.cnt('transactions', :U), '004');
select t.check('U đọc được cờ unlimited (UI)', t.val('authenticated', :U, $$select unlimited::text from credit_balances$$), 'true');

-- ===== admin_adjust_credit
select t.check('cộng +10: trả số dư mới 114', t.val('service_role', null,
  format($$select admin_adjust_credit(%L, %L, 10, 'tang credit beta')::text$$, :X, :A)), '114');
select t.check('... đúng 1 audit + 1 dòng sổ cái adjust, ref = audit:<id audit>', (select
  (count(*) = 1 and bool_and(l.ref = 'audit:' || a.id and l.delta = 10))::text
  from credit_ledger l join admin_audit_log a on a.action = 'adjust_credit' and a.target_user_id = :A
  where l.kind = 'adjust' and l.user_id = :A and l.ref like 'audit:%'), 'true');
select t.check('trừ -4 -> 110', t.val('service_role', null,
  format($$select admin_adjust_credit(%L, %L, -4, 'hoan tac nhap nham')::text$$, :X, :A)), '110');
select t.check('... audit payload ghi delta theo thứ tự', (select string_agg(payload ->> 'delta', ',' order by id)
  from admin_audit_log where action = 'adjust_credit'), '10,-4');
select t.check('âm quá số dư -> 22003', t.state('service_role', null,
  format($$select admin_adjust_credit(%L, %L, -9999, 'tru qua tay')$$, :X, :A)), '22003');
select t.check('... không audit mới, số dư giữ 110', t.bal(:A) || (select count(*)::text from admin_audit_log where action = 'adjust_credit'), '1102');
select t.check('delta 0 -> 22023', t.state('service_role', null, format($$select admin_adjust_credit(%L, %L, 0, 'khong doi gi')$$, :X, :A)), '22023');
select t.check('lý do ngắn -> 23514', t.state('service_role', null, format($$select admin_adjust_credit(%L, %L, 7, 'abc')$$, :X, :A)), '23514');
select t.check('... rollback cả sổ cái (số dư 110, không dòng +7)', t.bal(:A) || (select count(*)::text from credit_ledger where user_id = :A and delta = 7), '1100');
select t.check('user lạ -> P0002', t.state('service_role', null,
  format($$select admin_adjust_credit(%L, 'cccccccc-0000-4000-a000-0000000000cc', 5, 'user khong ton tai')$$, :X)), 'P0002');
select t.check('admin_user_stats có credit_balance + credit_unlimited', t.val('service_role', null, format(
  $$select credit_balance || '|' || credit_unlimited from admin_user_stats(array[%L::uuid])$$, :A)) || ',' || t.val('service_role', null, format(
  $$select credit_balance || '|' || credit_unlimited from admin_user_stats(array[%L::uuid])$$, :U)), '110|false,0|true');
select t.check('admin_user_ledger: mới nhất trước, chỉ 4 cột (không ref)', t.val('service_role', null, format(
  $$select (select string_agg(delta::text, ',') from (select delta from admin_user_ledger(%L, 2)) q) $$, :A)), '-4,10');
select t.check('admin_user_ledger trả đúng cột', pg_get_function_result('public.admin_user_ledger(uuid,integer)'::regprocedure),
  'TABLE(id bigint, delta integer, kind text, created_at timestamp with time zone)');

-- ===== bất biến + cascade
select t.check('bất biến: balance = sum(delta) cho MỌI user', (select count(*)::text from credit_balances b
  where b.balance <> coalesce((select sum(delta) from credit_ledger l where l.user_id = b.user_id), 0)), '0');
delete from auth.users where id = :A;
select t.check('xoá user -> sổ cái + số dư cascade', t.cnt('credit_ledger', :A)
  || (select count(*)::text from credit_balances where user_id = :A), '00');
