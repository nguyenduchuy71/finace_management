-- Kiểm tra RLS / ràng buộc / RPC của migration 20261018140000_card_crud_mcc_cashback.sql,
-- gồm các ca CHÉO 2 USER mà test integration (chỉ có 1 test user) không phủ được.
--
-- Chạy trên Postgres 17 TẠM, không đụng stack Supabase đang chạy (không `db reset`):
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s cho Postgres khởi động xong)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql        # role + auth.uid() giả
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -f - < supabase/tests/card-crud-rls.sql | grep -E "PASS|FAIL|ERROR"
--   docker rm -f scratch-pg17
-- Mỗi ca in PASS hoặc dừng bằng FAIL. File chỉ chạy được MỘT lần trên mỗi DB (insert user cố định).
\set ON_ERROR_STOP on
create schema if not exists t;
-- ok/ERR assertion: chạy stmt dưới role+uid, so sqlstate ('ok' nếu thành công)
create or replace function t.state(role_name text, uid uuid, stmt text) returns text language plpgsql as $$
declare got text := 'ok';
begin
  execute format('set local role %I', role_name);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  begin execute stmt; exception when others then got := sqlstate; end;
  reset role;
  return got;
end $$;
-- scalar assertion
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
-- seed (superuser = service_role): thẻ B + thẻ A có sẵn + giao dịch
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('bbbbbbbb-1111-4000-a000-000000000001','bbbbbbbb-0000-4000-a000-000000000002','VPBank','B card','****b001','visa',5,25),
 ('aaaaaaaa-1111-4000-a000-000000000001','aaaaaaaa-0000-4000-a000-000000000001','LPBank','A seed','****a001','visa',5,25),
 ('aaaaaaaa-1111-4000-a000-000000000002','aaaaaaaa-0000-4000-a000-000000000001','SHB','A other','****a002','amex',9,29);
insert into transactions(user_id,bank_name,amount,transaction_date,source_type,card_id) values
 ('aaaaaaaa-0000-4000-a000-000000000001','LPBank',-100000,now(),'credit_card','aaaaaaaa-1111-4000-a000-000000000001'),
 ('aaaaaaaa-0000-4000-a000-000000000001','LPBank',-200000,now(),'credit_card','aaaaaaaa-1111-4000-a000-000000000001'),
 ('aaaaaaaa-0000-4000-a000-000000000001','LPBank',-300000,now(),'credit_card','aaaaaaaa-1111-4000-a000-000000000001'),
 ('aaaaaaaa-0000-4000-a000-000000000001','SHB',-50000,now(),'credit_card','aaaaaaaa-1111-4000-a000-000000000002'),
 ('bbbbbbbb-0000-4000-a000-000000000002','VPBank',-70000,now(),'credit_card','bbbbbbbb-1111-4000-a000-000000000001');

\set A '\'aaaaaaaa-0000-4000-a000-000000000001\'::uuid'
\set B '\'bbbbbbbb-0000-4000-a000-000000000002\'::uuid'

-- ===== credit_cards CRUD
select t.check('A insert card, user_id mặc định = auth.uid()', t.state('authenticated', :A,
 $$insert into credit_cards(bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values ('Sacombank','A new','****x265','mastercard',10,30)$$),'ok');
select t.check('user_id mặc định đúng là A', t.val('authenticated', :A, $$select user_id::text from credit_cards where card_number='****x265'$$), 'aaaaaaaa-0000-4000-a000-000000000001');
select t.check('A không insert thẻ mang user_id của B', t.state('authenticated', :A,
 $$insert into credit_cards(user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values ('bbbbbbbb-0000-4000-a000-000000000002','X','x','****zzzz','visa',1,2)$$),'42501');
select t.check('unique (user,bank,number) chặn trùng', t.state('authenticated', :A,
 $$insert into credit_cards(bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values ('Sacombank','dup','****x265','visa',1,2)$$),'23505');
select t.check('cùng số khác bank được phép', t.state('authenticated', :A,
 $$insert into credit_cards(bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values ('UOB','same number other bank','****x265','visa',1,2)$$),'ok');
select t.check('B cùng bank+số với A được phép (unique theo user)', t.state('authenticated', :B,
 $$insert into credit_cards(bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values ('Sacombank','B same','****x265','visa',1,2)$$),'ok');
select t.check('A update thẻ B = 0 dòng', t.val('authenticated', :A,
 $$with u as (update credit_cards set card_name='hack' where id='bbbbbbbb-1111-4000-a000-000000000001' returning 1) select count(*)::text from u$$),'0');
select t.check('A delete thẻ B = 0 dòng', t.val('authenticated', :A,
 $$with d as (delete from credit_cards where id='bbbbbbbb-1111-4000-a000-000000000001' returning 1) select count(*)::text from d$$),'0');
select t.check('A không đổi user_id thẻ sang B', t.state('authenticated', :A,
 $$update credit_cards set user_id='bbbbbbbb-0000-4000-a000-000000000002' where id='aaaaaaaa-1111-4000-a000-000000000001'$$),'42501');
select t.check('anon không insert thẻ', t.state('anon', null,
 $$insert into credit_cards(user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values ('aaaaaaaa-0000-4000-a000-000000000001','X','x','****qqqq','visa',1,2)$$),'42501');
select t.check('card_type amex vẫn hợp lệ (A other)', t.val('authenticated', :A, $$select card_type from credit_cards where id='aaaaaaaa-1111-4000-a000-000000000002'$$),'amex');

-- ===== transactions.mcc
select t.check('mcc hợp lệ', t.state('authenticated', :A, $$update transactions set mcc='5411' where card_id='aaaaaaaa-1111-4000-a000-000000000002'$$),'ok');
select t.check('mcc 3 chữ số bị từ chối', t.state('authenticated', :A, $$update transactions set mcc='541' where card_id='aaaaaaaa-1111-4000-a000-000000000002'$$),'23514');
select t.check('mcc chữ bị từ chối', t.state('authenticated', :A, $$update transactions set mcc='abcd' where card_id='aaaaaaaa-1111-4000-a000-000000000002'$$),'23514');
select t.check('mcc null (bỏ phân loại) được phép', t.state('authenticated', :A, $$update transactions set mcc=null where card_id='aaaaaaaa-1111-4000-a000-000000000002'$$),'ok');

-- ===== card_cashback_rules
select t.check('A tạo rule mặc định cho thẻ mình', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent) values ('aaaaaaaa-1111-4000-a000-000000000001',null,0.5)$$),'ok');
select t.check('rule mặc định thứ 2 bị chặn (nulls not distinct)', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent) values ('aaaaaaaa-1111-4000-a000-000000000001',null,1)$$),'23505');
select t.check('A tạo rule MCC 5812 với min/cap', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent,min_cycle_spend,cap_per_cycle) values ('aaaaaaaa-1111-4000-a000-000000000001','5812',5,1000000,200000)$$),'ok');
select t.check('rule MCC trùng bị chặn', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent) values ('aaaaaaaa-1111-4000-a000-000000000001','5812',2)$$),'23505');
select t.check('rate > 100 bị chặn', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent) values ('aaaaaaaa-1111-4000-a000-000000000001','5411',101)$$),'23514');
select t.check('rate < 0 bị chặn', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent) values ('aaaaaaaa-1111-4000-a000-000000000001','5411',-1)$$),'23514');
select t.check('mcc rule sai định dạng bị chặn', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent) values ('aaaaaaaa-1111-4000-a000-000000000001','58',1)$$),'23514');
select t.check('cap = 0 bị chặn', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent,cap_per_cycle) values ('aaaaaaaa-1111-4000-a000-000000000001','5411',1,0)$$),'23514');
select t.check('min âm bị chặn', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent,min_cycle_spend) values ('aaaaaaaa-1111-4000-a000-000000000001','5411',1,-5)$$),'23514');
select t.check('A KHÔNG gắn rule vào thẻ của B', t.state('authenticated', :A,
 $$insert into card_cashback_rules(card_id,mcc,rate_percent) values ('bbbbbbbb-1111-4000-a000-000000000001','5411',1)$$),'42501');
select t.check('A KHÔNG chuyển rule của mình sang thẻ B', t.state('authenticated', :A,
 $$update card_cashback_rules set card_id='bbbbbbbb-1111-4000-a000-000000000001' where mcc='5812'$$),'42501');
select t.check('A KHÔNG giả user_id B khi tạo rule', t.state('authenticated', :A,
 $$insert into card_cashback_rules(user_id,card_id,mcc,rate_percent) values ('bbbbbbbb-0000-4000-a000-000000000002','aaaaaaaa-1111-4000-a000-000000000001','5411',1)$$),'42501');
select t.check('B không thấy rule của A', t.val('authenticated', :B, $$select count(*)::text from card_cashback_rules$$),'0');
select t.check('A thấy 2 rule của mình', t.val('authenticated', :A, $$select count(*)::text from card_cashback_rules$$),'2');
select t.check('A update rule của mình', t.state('authenticated', :A, $$update card_cashback_rules set rate_percent=6 where mcc='5812'$$),'ok');
select t.check('anon không đọc rule', t.state('anon', null, $$select * from card_cashback_rules$$),'42501');
select t.check('anon không ghi rule', t.state('anon', null,
 $$insert into card_cashback_rules(user_id,card_id,rate_percent) values ('aaaaaaaa-0000-4000-a000-000000000001','aaaaaaaa-1111-4000-a000-000000000001',1)$$),'42501');

-- ===== delete_credit_card
select t.check('RPC xóa thẻ người khác -> P0002', t.state('authenticated', :A, $$select public.delete_credit_card('bbbbbbbb-1111-4000-a000-000000000001')$$),'P0002');
select t.check('...và giao dịch của B còn nguyên', (select count(*)::text from transactions where card_id='bbbbbbbb-1111-4000-a000-000000000001'),'1');
select t.check('RPC thẻ không tồn tại -> P0002', t.state('authenticated', :A, $$select public.delete_credit_card(gen_random_uuid())$$),'P0002');
select t.check('anon không gọi được RPC', t.state('anon', null, $$select public.delete_credit_card('aaaaaaaa-1111-4000-a000-000000000001')$$),'42501');
select t.check('RPC xóa thẻ A trả 3 giao dịch', t.val('authenticated', :A, $$select public.delete_credit_card('aaaaaaaa-1111-4000-a000-000000000001')::text$$),'3');
select t.check('thẻ đã mất', (select count(*)::text from credit_cards where id='aaaaaaaa-1111-4000-a000-000000000001'),'0');
select t.check('giao dịch của thẻ đó đã mất (không mồ côi)', (select count(*)::text from transactions where card_id='aaaaaaaa-1111-4000-a000-000000000001' or (user_id='aaaaaaaa-0000-4000-a000-000000000001' and bank_name='LPBank')),'0');
select t.check('thẻ khác của A còn giao dịch', (select count(*)::text from transactions where card_id='aaaaaaaa-1111-4000-a000-000000000002'),'1');
select t.check('rule của thẻ bị xóa cascade', (select count(*)::text from card_cashback_rules where card_id='aaaaaaaa-1111-4000-a000-000000000001'),'0');
select t.check('thẻ có 0 giao dịch xóa trả 0', t.val('authenticated', :A, $$select public.delete_credit_card((select id from credit_cards where bank_name='UOB'))::text$$),'0');
select t.check('dashboard RPC vẫn chạy (không hồi quy)', t.state('authenticated', :A, $$select public.get_dashboard_stats(now()-interval '30 days', now()+interval '1 day')$$),'ok');

-- ===== transactions: card_id / account_id phải thuộc chính user (own_tx_insert/update)
insert into accounts(id,user_id,bank_name,account_name,account_number,account_type) values
 ('bbbbbbbb-2222-4000-a000-000000000001','bbbbbbbb-0000-4000-a000-000000000002','VPBank','B acc','****b900','checking');
select t.check('A không chèn giao dịch vào thẻ của B', t.state('authenticated', :A,
 $$insert into transactions(user_id,bank_name,amount,transaction_date,card_id) values ('aaaaaaaa-0000-4000-a000-000000000001','X',-1,now(),'bbbbbbbb-1111-4000-a000-000000000001')$$),'42501');
select t.check('A không chèn giao dịch vào tài khoản của B', t.state('authenticated', :A,
 $$insert into transactions(user_id,bank_name,amount,transaction_date,account_id) values ('aaaaaaaa-0000-4000-a000-000000000001','X',-1,now(),'bbbbbbbb-2222-4000-a000-000000000001')$$),'42501');
select t.check('A không sửa giao dịch của mình sang thẻ B', t.state('authenticated', :A,
 $$update transactions set card_id='bbbbbbbb-1111-4000-a000-000000000001' where card_id='aaaaaaaa-1111-4000-a000-000000000002'$$),'42501');
-- C1 (migration 20261101100000): authenticated KHÔNG còn INSERT transactions (policy own_tx_insert bị gỡ, grant bị thu hồi).
select t.check('A không chèn giao dịch vào thẻ của mình (C1: không còn đường ghi không trừ credit)', t.state('authenticated', :A,
 $$insert into transactions(user_id,bank_name,amount,transaction_date,card_id) values ('aaaaaaaa-0000-4000-a000-000000000001','SHB',-1,now(),'aaaaaaaa-1111-4000-a000-000000000002')$$),'42501');
select t.check('A không chèn giao dịch chưa gắn thẻ/TK (C1)', t.state('authenticated', :A,
 $$insert into transactions(user_id,bank_name,amount,transaction_date) values ('aaaaaaaa-0000-4000-a000-000000000001','X',-1,now())$$),'42501');
select t.check('không có giao dịch của A trỏ vào thẻ B', (select count(*)::text from transactions where user_id='aaaaaaaa-0000-4000-a000-000000000001' and card_id='bbbbbbbb-1111-4000-a000-000000000001'),'0');
