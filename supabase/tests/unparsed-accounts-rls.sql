-- Kiểm tra RLS / ràng buộc / RPC của migration 20261021100000_unparsed_inbox_kind_accounts.sql,
-- gồm các ca CHÉO 2 USER mà test integration (chỉ có 1 test user) không phủ được.
--
-- Chạy trên Postgres 17 TẠM (giống card-crud-rls.sql), không đụng stack Supabase đang chạy:
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -f - < supabase/tests/unparsed-accounts-rls.sql | grep -E "PASS|FAIL|ERROR"
--   docker rm -f scratch-pg17
-- Kiểm backfill user_id (migration phải gán tin cũ cho chủ thẻ duy nhất): trước khi chạy
-- migration 20261021100000, chèn 1 thẻ + 1 tin không user_id, rồi chạy nó và
-- `select user_id from unparsed_messages` — xem hướng dẫn trong phase-01 của plan.
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

insert into auth.users values ('aaaaaaaa-0000-4000-a000-000000000001'),('bbbbbbbb-0000-4000-a000-000000000002');
-- seed (superuser = service_role): TK + thẻ của A và B, tin của A và B
insert into accounts(id,user_id,bank_name,account_name,account_number,account_type) values
 ('aaaaaaaa-2222-4000-a000-000000000001','aaaaaaaa-0000-4000-a000-000000000001','BIDV','A acc','****3946','checking'),
 ('bbbbbbbb-2222-4000-a000-000000000001','bbbbbbbb-0000-4000-a000-000000000002','OCB','B acc','****0265','checking');
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('aaaaaaaa-1111-4000-a000-000000000001','aaaaaaaa-0000-4000-a000-000000000001','OCB','A card','****9586','visa',5,25),
 ('bbbbbbbb-1111-4000-a000-000000000001','bbbbbbbb-0000-4000-a000-000000000002','VPBank','B card','****b001','visa',5,25);
insert into unparsed_messages(id,user_id,raw_text,suggested_kind) values
 ('aaaaaaaa-3333-4000-a000-000000000001','aaaaaaaa-0000-4000-a000-000000000001','A msg 1','transaction'),
 ('aaaaaaaa-3333-4000-a000-000000000002','aaaaaaaa-0000-4000-a000-000000000001','A msg 2','transaction'),
 ('aaaaaaaa-3333-4000-a000-000000000003','aaaaaaaa-0000-4000-a000-000000000001','A msg 3','promo'),
 ('aaaaaaaa-3333-4000-a000-000000000004','aaaaaaaa-0000-4000-a000-000000000001','A msg 4','transaction'),
 ('bbbbbbbb-3333-4000-a000-000000000001','bbbbbbbb-0000-4000-a000-000000000002','B msg','transaction');
insert into transactions(id,user_id,bank_name,amount,transaction_date,source_type,card_id) values
 ('bbbbbbbb-4444-4000-a000-000000000001','bbbbbbbb-0000-4000-a000-000000000002','VPBank',-70000,now(),'credit_card','bbbbbbbb-1111-4000-a000-000000000001');

\set A '\'aaaaaaaa-0000-4000-a000-000000000001\'::uuid'
\set B '\'bbbbbbbb-0000-4000-a000-000000000002\'::uuid'

-- ===== unparsed_messages: đọc / sửa
select t.check('A chỉ thấy tin của mình', t.val('authenticated', :A, $$select count(*)::text from unparsed_messages$$), '4');
select t.check('anon không đọc được tin', t.state('anon', null, $$select 1 from unparsed_messages$$), '42501');
select t.check('A không insert tin', t.state('authenticated', :A,
 $$insert into unparsed_messages(raw_text,user_id) values ('x', auth.uid())$$), '42501');
select t.check('A không delete tin', t.state('authenticated', :A, $$delete from unparsed_messages$$), '42501');
select t.check('A không sửa raw_text (grant theo cột)', t.state('authenticated', :A,
 $$update unparsed_messages set raw_text='x' where id='aaaaaaaa-3333-4000-a000-000000000001'$$), '42501');
select t.check('A update tin của B = 0 dòng', t.val('authenticated', :A,
 $$with u as (update unparsed_messages set resolved=true where id='bbbbbbbb-3333-4000-a000-000000000001' returning 1) select count(*)::text from u$$), '0');
select t.check('A không gắn transaction_id của B', t.state('authenticated', :A,
 $$update unparsed_messages set transaction_id='bbbbbbbb-4444-4000-a000-000000000001' where id='aaaaaaaa-3333-4000-a000-000000000004'$$), '42501');

-- ===== resolve_unparsed
select t.check('A resolve tin normal vào TK của mình -> tạo giao dịch', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000001','normal',
   '{"amount":-84000,"transaction_date":"2026-10-19T16:35:00+07:00","description":"chuyen khoan","account_id":"aaaaaaaa-2222-4000-a000-000000000001"}')$$), 'ok');
select t.check('giao dịch lấy bank_name/source_type từ TK, raw_text từ tin', t.val('authenticated', :A,
 $$select bank_name||'|'||source_type||'|'||raw_text||'|'||kind from transactions where account_id='aaaaaaaa-2222-4000-a000-000000000001'$$),
 'BIDV|bank|A msg 1|normal');
select t.check('tin đã resolved + liên kết giao dịch', t.val('authenticated', :A,
 $$select (resolved and kind='normal' and transaction_id is not null)::text from unparsed_messages where id='aaaaaaaa-3333-4000-a000-000000000001'$$), 'true');
select t.check('resolve lần 2 -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000001','promo')$$), '22023');
select t.check('A resolve tin của B -> P0002', t.state('authenticated', :A,
 $$select resolve_unparsed('bbbbbbbb-3333-4000-a000-000000000001','promo')$$), 'P0002');
select t.check('A resolve vào thẻ của B -> P0002', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000002','normal',
   '{"amount":-1000,"transaction_date":"2026-10-19T00:00:00Z","card_id":"bbbbbbbb-1111-4000-a000-000000000001"}')$$), 'P0002');
select t.check('thiếu p_tx với normal -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000002','normal')$$), '22023');
select t.check('cả account_id lẫn card_id -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000002','normal',
   '{"amount":-1000,"transaction_date":"2026-10-19T00:00:00Z","card_id":"aaaaaaaa-1111-4000-a000-000000000001","account_id":"aaaaaaaa-2222-4000-a000-000000000001"}')$$), '22023');
select t.check('amount 0 -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000002','normal',
   '{"amount":0,"transaction_date":"2026-10-19T00:00:00Z","card_id":"aaaaaaaa-1111-4000-a000-000000000001"}')$$), '22023');
select t.check('promo kèm p_tx -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000003','promo','{"amount":1}')$$), '22023');
select t.check('kind lạ -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000003','bogus')$$), '22023');
select t.check('lỗi giữa chừng không để lại tin resolved', t.val('authenticated', :A,
 $$select count(*)::text from unparsed_messages where resolved$$), '1');
select t.check('A resolve internal_transfer vào thẻ của mình', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000002','internal_transfer',
   '{"amount":100000,"transaction_date":"2026-10-20T11:29:00+07:00","card_id":"aaaaaaaa-1111-4000-a000-000000000001"}')$$), 'ok');
select t.check('A gắn nhãn promo không tạo giao dịch', t.val('authenticated', :A,
 $$select coalesce(resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000003','promo')::text,'null')$$), 'null');

-- ===== dashboard loại internal_transfer
select t.check('dashboard: tổng thu/chi bỏ qua internal_transfer', t.val('authenticated', :A,
 $$select (s->>'totalIncome')||'|'||(s->>'totalExpense')||'|'||(s->>'transactionCount') from get_dashboard_stats() s$$),
 '0|84000|1');

-- ===== accounts CRUD
select t.check('A thêm TK, user_id mặc định = auth.uid()', t.state('authenticated', :A,
 $$insert into accounts(bank_name,account_name,account_number,account_type) values ('LPBank','A new','****x265','checking')$$), 'ok');
select t.check('A thêm TK trùng (bank, số) -> 23505', t.state('authenticated', :A,
 $$insert into accounts(bank_name,account_name,account_number,account_type) values ('LPBank','dup','****x265','checking')$$), '23505');
select t.check('số TK không đúng mask -> 23514', t.state('authenticated', :A,
 $$insert into accounts(bank_name,account_name,account_number,account_type) values ('SHB','bad','0349360265','checking')$$), '23514');
select t.check('A không thêm TK cho B', t.state('authenticated', :A,
 $$insert into accounts(user_id,bank_name,account_name,account_number,account_type) values ('bbbbbbbb-0000-4000-a000-000000000002','SHB','x','****1111','checking')$$), '42501');
select t.check('A xoá TK của B -> P0002', t.state('authenticated', :A,
 $$select delete_bank_account('bbbbbbbb-2222-4000-a000-000000000001')$$), 'P0002');
select t.check('TK của B còn nguyên', (select count(*)::text from accounts where id='bbbbbbbb-2222-4000-a000-000000000001'), '1');
select t.check('A xoá TK của mình kèm 1 giao dịch', t.val('authenticated', :A,
 $$select delete_bank_account('aaaaaaaa-2222-4000-a000-000000000001')::text$$), '1');
select t.check('tin liên kết giao dịch đã xoá -> transaction_id null', t.val('authenticated', :A,
 $$select (transaction_id is null)::text from unparsed_messages where id='aaaaaaaa-3333-4000-a000-000000000001'$$), 'true');
select t.check('anon không gọi được resolve_unparsed', t.state('anon', null,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000004','promo')$$), '42501');

-- ===== bất biến sau resolve + validate tham số (review phase 01: M1-M4)
select t.check('không bỏ resolved của tin đã xử lý', t.state('authenticated', :A,
 $$update unparsed_messages set resolved=false where id='aaaaaaaa-3333-4000-a000-000000000002'$$), '22023');
select t.check('không đổi kind của tin đã xử lý', t.state('authenticated', :A,
 $$update unparsed_messages set kind='normal' where id='aaaaaaaa-3333-4000-a000-000000000003'$$), '22023');
select t.check('không gắn 1 giao dịch cho 2 tin', t.state('authenticated', :A,
 $$update unparsed_messages set transaction_id=(select transaction_id from unparsed_messages where id='aaaaaaaa-3333-4000-a000-000000000002') where id='aaaaaaaa-3333-4000-a000-000000000004'$$), '23505');
select t.check('ngày không có múi giờ -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000004','normal',
   '{"amount":-1000,"transaction_date":"2026-10-19","card_id":"aaaaaaaa-1111-4000-a000-000000000001"}')$$), '22023');
select t.check('amount thập phân -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000004','normal',
   '{"amount":"1.5","transaction_date":"2026-10-19T00:00:00Z","card_id":"aaaaaaaa-1111-4000-a000-000000000001"}')$$), '22023');
select t.check('card_id không phải uuid -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000004','normal',
   '{"amount":-1,"transaction_date":"2026-10-19T00:00:00Z","card_id":"xyz"}')$$), '22023');
select t.check('category lạ -> 22023', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000004','normal',
   '{"amount":-1,"transaction_date":"2026-10-19T00:00:00Z","card_id":"aaaaaaaa-1111-4000-a000-000000000001","category":"Hack"}')$$), '22023');
select t.check('ngày có offset +07:00 và category hợp lệ -> ok', t.state('authenticated', :A,
 $$select resolve_unparsed('aaaaaaaa-3333-4000-a000-000000000004','normal',
   '{"amount":-1,"transaction_date":"2026-10-19T08:00:00+07:00","card_id":"aaaaaaaa-1111-4000-a000-000000000001","category":"Ăn uống"}')$$), 'ok');
