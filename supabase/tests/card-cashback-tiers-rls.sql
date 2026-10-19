-- Kiểm tra RLS / ràng buộc / RPC của migration 20261019100000_cashback_tiers_card_cap.sql
-- (bậc thang, trần thẻ, save_cashback_rule), gồm các ca CHÉO 2 USER.
--
-- Chạy như card-crud-rls.sql (xem hướng dẫn ở đầu file đó): Postgres 17 TẠM, áp stub + toàn bộ
-- migration, rồi:
--   $P -f - < supabase/tests/card-cashback-tiers-rls.sql | grep -E "PASS|FAIL|ERROR"
-- File tự chứa (tự tạo helper t.*, dùng ID riêng) nên chạy được trước hoặc sau card-crud-rls.sql,
-- nhưng chỉ MỘT lần trên mỗi DB.
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

insert into auth.users values ('aaaaaaaa-0000-4000-a000-000000000001'),('bbbbbbbb-0000-4000-a000-000000000002')
  on conflict do nothing;
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('cccccccc-1111-4000-a000-000000000001','aaaaaaaa-0000-4000-a000-000000000001','LPBank','A tier card','****c001','visa',5,25),
 ('cccccccc-1111-4000-a000-000000000002','aaaaaaaa-0000-4000-a000-000000000001','SHB','A second','****c002','visa',5,25),
 ('cccccccc-1111-4000-a000-000000000003','bbbbbbbb-0000-4000-a000-000000000002','VPBank','B tier card','****c003','visa',5,25);

\set A '\'aaaaaaaa-0000-4000-a000-000000000001\'::uuid'
\set B '\'bbbbbbbb-0000-4000-a000-000000000002\'::uuid'
\set CA '\'cccccccc-1111-4000-a000-000000000001\''
\set CA2 '\'cccccccc-1111-4000-a000-000000000002\''
\set CB '\'cccccccc-1111-4000-a000-000000000003\''

-- ===== save_cashback_rule: tạo mới kèm bậc
select t.val('authenticated', :A, $$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', null, '5411', 0.5, 5000000, 300000,
  '[{"minSpend":10000000,"ratePercent":1},{"minSpend":20000000,"ratePercent":1.5}]'::jsonb)::text$$) as rid \gset
select t.check('A tạo rule kèm 2 bậc, trả id', (:'rid' <> '')::text, 'true');
select t.check('2 bậc được lưu', (select count(*)::text from card_cashback_rule_tiers where rule_id = :'rid'), '2');
select t.check('bậc thuộc đúng user (user_id mặc định)', (select count(*)::text from card_cashback_rule_tiers where rule_id = :'rid' and user_id = 'aaaaaaaa-0000-4000-a000-000000000001'), '2');
select t.check('rule lưu đúng bậc nền', (select rate_percent::text || '/' || min_cycle_spend || '/' || cap_per_cycle from card_cashback_rules where id = :'rid'), '0.50/5000000/300000');

-- ===== sửa: bậc cũ bị thay, không nhân đôi
select t.check('A sửa rule, còn 1 bậc', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 0.75, 6000000, null,
  '[{"minSpend":12000000,"ratePercent":2}]'::jsonb)$$, :'rid')), 'ok');
select t.check('chỉ còn 1 bậc mới', (select count(*)::text || '/' || min(min_spend) from card_cashback_rule_tiers where rule_id = :'rid'), '1/12000000');
select t.check('rule được cập nhật (cap về null)', (select rate_percent::text || '/' || min_cycle_spend || '/' || coalesce(cap_per_cycle::text,'null') from card_cashback_rules where id = :'rid'), '0.75/6000000/null');

-- ===== validate RPC: sai thì lỗi VÀ rule + bậc giữ nguyên (nguyên tử)
select t.check('bậc giảm dần -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 9, 1, null,
  '[{"minSpend":20000000,"ratePercent":2},{"minSpend":10000000,"ratePercent":3}]'::jsonb)$$, :'rid')), '22023');
select t.check('...rule không đổi', (select rate_percent::text || '/' || min_cycle_spend from card_cashback_rules where id = :'rid'), '0.75/6000000');
select t.check('...bậc không đổi', (select count(*)::text || '/' || min(min_spend) from card_cashback_rule_tiers where rule_id = :'rid'), '1/12000000');
select t.check('bậc bằng ngưỡng nền -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 6000000, null,
  '[{"minSpend":6000000,"ratePercent":2}]'::jsonb)$$, :'rid')), '22023');
select t.check('hai bậc cùng mức -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '[{"minSpend":100,"ratePercent":2},{"minSpend":100,"ratePercent":3}]'::jsonb)$$, :'rid')), '22023');
select t.check('6 bậc -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '[{"minSpend":1,"ratePercent":1},{"minSpend":2,"ratePercent":1},{"minSpend":3,"ratePercent":1},{"minSpend":4,"ratePercent":1},{"minSpend":5,"ratePercent":1},{"minSpend":6,"ratePercent":1}]'::jsonb)$$, :'rid')), '22023');
select t.check('đúng 5 bậc được phép', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '[{"minSpend":1,"ratePercent":1},{"minSpend":2,"ratePercent":1},{"minSpend":3,"ratePercent":1},{"minSpend":4,"ratePercent":1},{"minSpend":5,"ratePercent":1}]'::jsonb)$$, :'rid')), 'ok');
select t.check('rate 101 -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '[{"minSpend":10,"ratePercent":101}]'::jsonb)$$, :'rid')), '22023');
select t.check('minSpend 0 -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '[{"minSpend":0,"ratePercent":1}]'::jsonb)$$, :'rid')), '22023');
select t.check('minSpend âm -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '[{"minSpend":-5,"ratePercent":1}]'::jsonb)$$, :'rid')), '22023');
select t.check('minSpend lẻ -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '[{"minSpend":1.5,"ratePercent":1}]'::jsonb)$$, :'rid')), '22023');
select t.check('rate 3 số lẻ -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '[{"minSpend":10,"ratePercent":1.234}]'::jsonb)$$, :'rid')), '22023');
select t.check('thiếu trường -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '[{"minSpend":10}]'::jsonb)$$, :'rid')), '22023');
select t.check('p_tiers không phải mảng -> 22023', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null,
  '{"minSpend":10}'::jsonb)$$, :'rid')), '22023');
select t.check('p_tiers null = không bậc', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 1, 0, null, null)$$, :'rid')), 'ok');
select t.check('...xoá hết bậc', (select count(*)::text from card_cashback_rule_tiers where rule_id = :'rid'), '0');
-- đặt lại 1 bậc cho các ca phía sau
select t.check('đặt lại 1 bậc', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 0.75, 6000000, null,
  '[{"minSpend":12000000,"ratePercent":2}]'::jsonb)$$, :'rid')), 'ok');

-- ===== tạo mới lỗi thì không để lại rule nửa vời
select t.check('tạo rule bậc sai -> 22023', t.state('authenticated', :A, $$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', null, '5812', 1, 0, null,
  '[{"minSpend":20,"ratePercent":1},{"minSpend":10,"ratePercent":1}]'::jsonb)$$), '22023');
select t.check('...không có rule 5812', (select count(*)::text from card_cashback_rules where card_id = 'cccccccc-1111-4000-a000-000000000001' and mcc = '5812'), '0');
select t.check('tạo rule trùng MCC -> 23505', t.state('authenticated', :A, $$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', null, '5411', 1, 0, null,
  '[{"minSpend":10,"ratePercent":1}]'::jsonb)$$), '23505');
select t.check('...bậc của rule gốc không đổi', (select count(*)::text || '/' || min(min_spend) from card_cashback_rule_tiers where rule_id = :'rid'), '1/12000000');
select t.check('tạo rule mặc định (mcc null) được', t.state('authenticated', :A, $$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', null, null, 1, 0, null, null)$$), 'ok');
select t.check('...(vừa tạo rule mặc định) sửa nó sang 5411 -> 23505', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001',
  (select id from card_cashback_rules where card_id = 'cccccccc-1111-4000-a000-000000000001' and mcc is null), '5411', 3, 0, null,
  '[{"minSpend":10,"ratePercent":1}]'::jsonb)$$)), '23505');
select t.check('...rule mặc định vẫn mcc null, không có bậc', (select count(*)::text from card_cashback_rules r where card_id = 'cccccccc-1111-4000-a000-000000000001' and mcc is null and not exists (select 1 from card_cashback_rule_tiers t where t.rule_id = r.id)), '1');

-- ===== chéo user: RPC
select t.check('B sửa rule của A (thẻ A) -> P0002', t.state('authenticated', :B, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', %L, '5411', 99, 0, null, '[]'::jsonb)$$, :'rid')), 'P0002');
select t.check('B sửa rule của A bằng thẻ của B -> P0002', t.state('authenticated', :B, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000003', %L, '5411', 99, 0, null, '[]'::jsonb)$$, :'rid')), 'P0002');
select t.check('A sửa rule của mình qua thẻ khác (không khớp) -> P0002', t.state('authenticated', :A, format($$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000002', %L, '5411', 99, 0, null, '[]'::jsonb)$$, :'rid')), 'P0002');
select t.check('B tạo rule trên thẻ của A -> 42501', t.state('authenticated', :B, $$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', null, '5999', 1, 0, null,
  '[{"minSpend":10,"ratePercent":1}]'::jsonb)$$), '42501');
select t.check('...rule + bậc của A không đổi', (select rate_percent::text || '/' || (select count(*) from card_cashback_rule_tiers t where t.rule_id = r.id) from card_cashback_rules r where id = :'rid'), '0.75/1');
select t.check('anon không gọi được RPC', t.state('anon', null, $$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000001', null, '5000', 1, 0, null, null)$$), '42501');

-- ===== chéo user: bảng bậc
select t.check('B không thấy bậc của A', t.val('authenticated', :B, $$select count(*)::text from card_cashback_rule_tiers$$), '0');
select t.check('A thấy bậc của mình', t.val('authenticated', :A, $$select count(*)::text from card_cashback_rule_tiers$$), '1');
select t.check('B không chèn bậc vào rule của A (user_id = B)', t.state('authenticated', :B, format($$insert into card_cashback_rule_tiers(rule_id,min_spend,rate_percent) values (%L, 50000000, 5)$$, :'rid')), '42501');
select t.check('B không giả user_id A khi chèn bậc', t.state('authenticated', :B, format($$insert into card_cashback_rule_tiers(user_id,rule_id,min_spend,rate_percent) values ('aaaaaaaa-0000-4000-a000-000000000001', %L, 50000000, 5)$$, :'rid')), '42501');
select t.check('A không chèn bậc mang user_id B', t.state('authenticated', :A, format($$insert into card_cashback_rule_tiers(user_id,rule_id,min_spend,rate_percent) values ('bbbbbbbb-0000-4000-a000-000000000002', %L, 50000000, 5)$$, :'rid')), '42501');
select t.check('A chèn trực tiếp bậc vào rule của mình', t.state('authenticated', :A, format($$insert into card_cashback_rule_tiers(rule_id,min_spend,rate_percent) values (%L, 50000000, 5)$$, :'rid')), 'ok');
select t.check('trùng (rule, min_spend) -> 23505', t.state('authenticated', :A, format($$insert into card_cashback_rule_tiers(rule_id,min_spend,rate_percent) values (%L, 50000000, 6)$$, :'rid')), '23505');
select t.check('min_spend 0 -> 23514', t.state('authenticated', :A, format($$insert into card_cashback_rule_tiers(rule_id,min_spend,rate_percent) values (%L, 0, 6)$$, :'rid')), '23514');
select t.check('rate 101 -> 23514', t.state('authenticated', :A, format($$insert into card_cashback_rule_tiers(rule_id,min_spend,rate_percent) values (%L, 60000000, 101)$$, :'rid')), '23514');
select t.val('authenticated', :B, $$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000003', null, '5411', 1, 0, null, '[{"minSpend":100,"ratePercent":2}]'::jsonb)::text$$) as rid_b \gset
select t.check('A không chuyển bậc của mình sang rule của B', t.state('authenticated', :A, format($$update card_cashback_rule_tiers set rule_id = %L where min_spend = 50000000$$, :'rid_b')), '42501');
select t.check('B update bậc của A = 0 dòng', t.val('authenticated', :B, format($$with u as (update card_cashback_rule_tiers set rate_percent = 99 where rule_id = %L returning 1) select count(*)::text from u$$, :'rid')), '0');
select t.check('B delete bậc của A = 0 dòng', t.val('authenticated', :B, format($$with d as (delete from card_cashback_rule_tiers where rule_id = %L returning 1) select count(*)::text from d$$, :'rid')), '0');
select t.check('anon không chèn bậc', t.state('anon', null, format($$insert into card_cashback_rule_tiers(user_id,rule_id,min_spend,rate_percent) values ('aaaaaaaa-0000-4000-a000-000000000001', %L, 70000000, 1)$$, :'rid')), '42501');
select t.check('bậc của A còn nguyên sau mọi ca của B (2 bậc)', (select count(*)::text from card_cashback_rule_tiers where rule_id = :'rid'), '2');

-- ===== cascade
select t.check('xoá rule -> bậc cascade', t.val('authenticated', :A, format($$with d as (delete from card_cashback_rules where id = %L returning 1) select count(*)::text from d$$, :'rid')), '1');
select t.check('...không còn bậc của rule đó', (select count(*)::text from card_cashback_rule_tiers where rule_id = :'rid'), '0');
select t.val('authenticated', :A, $$select public.save_cashback_rule('cccccccc-1111-4000-a000-000000000002', null, '5411', 1, 0, null, '[{"minSpend":100,"ratePercent":2},{"minSpend":200,"ratePercent":3}]'::jsonb)::text$$) as rid2 \gset
select t.check('thẻ 2 có 2 bậc', (select count(*)::text from card_cashback_rule_tiers where rule_id = :'rid2'), '2');
select t.check('xoá thẻ qua RPC', t.state('authenticated', :A, $$select public.delete_credit_card('cccccccc-1111-4000-a000-000000000002')$$), 'ok');
select t.check('...bậc biến mất theo thẻ', (select count(*)::text from card_cashback_rule_tiers where rule_id = :'rid2'), '0');

-- ===== credit_cards.cashback_monthly_cap
select t.check('cap = 0 bị chặn', t.state('authenticated', :A, $$update credit_cards set cashback_monthly_cap = 0 where id = 'cccccccc-1111-4000-a000-000000000001'$$), '23514');
select t.check('cap âm bị chặn', t.state('authenticated', :A, $$update credit_cards set cashback_monthly_cap = -1 where id = 'cccccccc-1111-4000-a000-000000000001'$$), '23514');
select t.check('A đặt cap thẻ mình', t.state('authenticated', :A, $$update credit_cards set cashback_monthly_cap = 600000 where id = 'cccccccc-1111-4000-a000-000000000001'$$), 'ok');
select t.check('cap đã lưu', (select cashback_monthly_cap::text from credit_cards where id = 'cccccccc-1111-4000-a000-000000000001'), '600000');
select t.check('B đặt cap thẻ của A = 0 dòng', t.val('authenticated', :B, $$with u as (update credit_cards set cashback_monthly_cap = 1 where id = 'cccccccc-1111-4000-a000-000000000001' returning 1) select count(*)::text from u$$), '0');
select t.check('...cap của A không đổi', (select cashback_monthly_cap::text from credit_cards where id = 'cccccccc-1111-4000-a000-000000000001'), '600000');
select t.check('A bỏ cap về null', t.state('authenticated', :A, $$update credit_cards set cashback_monthly_cap = null where id = 'cccccccc-1111-4000-a000-000000000001'$$), 'ok');
select t.check('thẻ mới mặc định không có cap', (select count(*)::text from credit_cards where id = 'cccccccc-1111-4000-a000-000000000001' and cashback_monthly_cap is null), '1');
