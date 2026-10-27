-- Kiểm tra RLS / grant / RPC của migration 20261028100000_admin_user_management.sql (admin + 2 user).
--
-- Chạy trên Postgres 17 TẠM (giống unparsed-accounts-rls.sql), không đụng stack Supabase đang chạy:
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -f - < supabase/tests/admin-rls.sql | grep -E "PASS|FAIL|ERROR"
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

-- Admin X (app_metadata do edge function kiểm, ở DB không khác user thường), user A có dữ liệu, user B trống.
insert into auth.users values
 ('99999999-0000-4000-a000-000000000009', null),
 ('aaaaaaaa-0000-4000-a000-000000000001', null),
 ('bbbbbbbb-0000-4000-a000-000000000002', null);

\set X '\'99999999-0000-4000-a000-000000000009\'::uuid'
\set A '\'aaaaaaaa-0000-4000-a000-000000000001\'::uuid'
\set B '\'bbbbbbbb-0000-4000-a000-000000000002\'::uuid'

-- dữ liệu A: 2 giao dịch trong 30 ngày + 1 cũ, 3 tin chưa phân loại, 2 key (1 đã thu hồi)
insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date) values
 ('aaaaaaaa-1111-4000-a000-000000000001',:A,'OCB','A card','****9586','visa',5,25);
insert into transactions(user_id,bank_name,amount,transaction_date,source_type,card_id,description,created_at) values
 (:A,'OCB',-70000,now(),'credit_card','aaaaaaaa-1111-4000-a000-000000000001','BI MAT A',now()),
 (:A,'OCB',-80000,now(),'credit_card','aaaaaaaa-1111-4000-a000-000000000001','BI MAT A',now()),
 (:A,'OCB',-90000,now(),'credit_card','aaaaaaaa-1111-4000-a000-000000000001','BI MAT A',now() - interval '40 days');
insert into unparsed_messages(user_id,raw_text,reason) values
 (:A,'SO DU BI MAT 1','no_match'),(:A,'SO DU BI MAT 2','no_match'),(:A,'SO DU BI MAT 3','no_account');
select t.val('authenticated', :A, $$select create_api_key('iPhone')$$) is not null;
select t.val('authenticated', :A, $$select create_api_key('iPad')$$) is not null;
update api_keys set revoked_at = now() where user_id = :A and name = 'iPad';

-- ===== quyền: chỉ service_role
select t.check('authenticated không gọi admin_user_stats', t.state('authenticated', :X, $$select * from admin_user_stats()$$), '42501');
select t.check('authenticated không gọi admin_set_suspended', t.state('authenticated', :X,
  $$select admin_set_suspended(auth.uid(), 'aaaaaaaa-0000-4000-a000-000000000001', true, 'thu quyen')$$), '42501');
select t.check('authenticated không gọi admin_revoke_user_keys', t.state('authenticated', :X,
  $$select admin_revoke_user_keys(auth.uid(), 'aaaaaaaa-0000-4000-a000-000000000001', 'thu quyen')$$), '42501');
select t.check('authenticated không gọi admin_user_keys', t.state('authenticated', :X,
  $$select * from admin_user_keys('aaaaaaaa-0000-4000-a000-000000000001')$$), '42501');
select t.check('authenticated không gọi admin_list_audit', t.state('authenticated', :X, $$select * from admin_list_audit()$$), '42501');
select t.check('anon không gọi admin_user_stats', t.state('anon', null, $$select * from admin_user_stats()$$), '42501');
select t.check('authenticated không đọc admin_audit_log', t.state('authenticated', :X, $$select 1 from admin_audit_log$$), '42501');
select t.check('authenticated không ghi admin_audit_log', t.state('authenticated', :X,
  $$insert into admin_audit_log(admin_id,action,reason) values (auth.uid(),'suspend','tu ghi audit')$$), '42501');

-- ===== thống kê: chỉ đếm
select t.check('stats A: 1 key active, 2 tx/30 ngày, unparsed theo reason', t.val('service_role', null,
  $$select keys_active || '|' || tx_count_30d || '|' || unparsed_30d::text from admin_user_stats(array['aaaaaaaa-0000-4000-a000-000000000001'::uuid])$$),
  '1|2|{"no_match": 2, "no_account": 1}');
select t.check('stats B: 0 key, 0 tx, {}', t.val('service_role', null,
  $$select keys_active || '|' || tx_count_30d || '|' || unparsed_30d::text from admin_user_stats(array['bbbbbbbb-0000-4000-a000-000000000002'::uuid])$$),
  '0|0|{}');
select t.check('stats null = mọi user có settings (3)', t.val('service_role', null, $$select count(*)::text from admin_user_stats()$$), '3');
select t.check('stats không chứa nội dung giao dịch / tin nhắn', t.val('service_role', null,
  $$select (string_agg(to_jsonb(s)::text, '') !~ 'BI MAT|70000|SO DU')::text from admin_user_stats() s$$), 'true');
select t.check('admin_user_keys: 2 key, key còn hiệu lực trước', t.val('service_role', null,
  $$select string_agg(name, ',') from admin_user_keys('aaaaaaaa-0000-4000-a000-000000000001')$$), 'iPhone,iPad');

-- ===== khoá / mở khoá
select t.check('lý do < 5 ký tự -> 23514, không đổi gì', t.state('service_role', null,
  $$select admin_set_suspended('99999999-0000-4000-a000-000000000009','aaaaaaaa-0000-4000-a000-000000000001', true, 'abc')$$), '23514');
select t.check('... và cờ khoá vẫn null (rollback cùng transaction)', (select (suspended_at is null)::text from user_settings where user_id = :A), 'true');
select t.check('user lạ -> P0002', t.state('service_role', null,
  $$select admin_set_suspended('99999999-0000-4000-a000-000000000009','cccccccc-0000-4000-a000-000000000003', true, 'lam dung api')$$), 'P0002');
select t.check('khoá A', t.state('service_role', null,
  $$select admin_set_suspended('99999999-0000-4000-a000-000000000009','aaaaaaaa-0000-4000-a000-000000000001', true, 'lam dung api')$$), 'ok');
select t.check('A bị khoá + đúng 1 audit suspend', (select
  (s.suspended_at is not null
   and (select count(*) from admin_audit_log where action='suspend' and target_user_id = :A) = 1)::text
  from user_settings s where s.user_id = :A), 'true');
select t.check('stats: lý do khoá lấy từ audit', t.val('service_role', null,
  $$select suspended_reason from admin_user_stats(array['aaaaaaaa-0000-4000-a000-000000000001'::uuid])$$), 'lam dung api');
select t.check('user_settings KHÔNG có cột lý do (user đọc được bảng này)', (select count(*)::text from information_schema.columns
  where table_schema = 'public' and table_name = 'user_settings' and column_name like '%reason%'), '0');

-- khoá có hiệu lực NGAY với access token còn hạn: policy restrictive chặn dữ liệu, user_settings vẫn đọc được
select t.check('A bị khoá: không đọc được giao dịch', t.val('authenticated', :A, $$select count(*)::text from transactions$$), '0');
select t.check('A bị khoá: không thấy thẻ / hộp tin / key', t.val('authenticated', :A,
  $$select ((select count(*) from credit_cards) + (select count(*) from unparsed_messages) + (select count(*) from api_keys))::text$$), '0');
select t.check('A bị khoá: không tạo được key mới', t.state('authenticated', :A, $$select create_api_key('lach khoa')$$), '42501');
select t.check('A bị khoá: không ghi được giao dịch', t.state('authenticated', :A,
  $$insert into transactions(user_id,bank_name,amount,transaction_date,source_type,card_id) values (auth.uid(),'OCB',-1,now(),'credit_card','aaaaaaaa-1111-4000-a000-000000000001')$$), '42501');
select t.check('B không bị khoá: vẫn đọc dữ liệu bình thường', t.state('authenticated', :B, $$select count(*) from transactions$$), 'ok');
select t.check('A đọc được cờ khoá của mình', t.val('authenticated', :A,
  $$select (suspended_at is not null)::text from user_settings$$), 'true');
select t.check('A không tự mở khoá', t.state('authenticated', :A,
  $$update user_settings set suspended_at = null$$), '42501');
select t.check('authenticate_api_key báo suspended', t.val('service_role', null,
  format($$select suspended::text from authenticate_api_key(%L)$$,
    (select encode(key_hash, 'hex') from api_keys where user_id = :A and revoked_at is null))), 'true');
select t.check('mở khoá A -> cờ null + audit unsuspend', t.state('service_role', null,
  $$select admin_set_suspended('99999999-0000-4000-a000-000000000009','aaaaaaaa-0000-4000-a000-000000000001', false, 'da xac minh')$$), 'ok');
select t.check('A hết khoá', (select (suspended_at is null)::text from user_settings where user_id = :A), 'true');
select t.check('stats: hết khoá -> không còn lý do', t.val('service_role', null,
  $$select coalesce(suspended_reason, 'null') from admin_user_stats(array['aaaaaaaa-0000-4000-a000-000000000001'::uuid])$$), 'null');
select t.check('A mở khoá: đọc lại được 3 giao dịch', t.val('authenticated', :A, $$select count(*)::text from transactions$$), '3');

-- tỉ lệ parse: giao dịch user tự ghi từ hộp tin KHÔNG tính là parser ghi
update unparsed_messages set resolved = true, kind = 'normal',
  transaction_id = (select id from transactions where user_id = :A and created_at >= now() - interval '1 day' limit 1)
  where user_id = :A and raw_text = 'SO DU BI MAT 1';
select t.check('stats: tx resolve từ hộp tin không đếm vào tx_count_30d', t.val('service_role', null,
  $$select tx_count_30d::text from admin_user_stats(array['aaaaaaaa-0000-4000-a000-000000000001'::uuid])$$), '1');

-- xem chi tiết user để lại audit
select t.check('admin_log_view ghi view_user', t.state('service_role', null,
  $$select admin_log_view('99999999-0000-4000-a000-000000000009','aaaaaaaa-0000-4000-a000-000000000001')$$), 'ok');
select t.check('authenticated không gọi admin_log_view', t.state('authenticated', :A,
  $$select admin_log_view(auth.uid(), auth.uid())$$), '42501');
select t.check('authenticate_api_key hết suspended', t.val('service_role', null,
  format($$select suspended::text from authenticate_api_key(%L)$$,
    (select encode(key_hash, 'hex') from api_keys where user_id = :A and revoked_at is null))), 'false');

-- ===== thu hồi mọi key
select t.check('thu hồi key A -> 1 (key đã thu hồi không tính)', t.val('service_role', null,
  $$select admin_revoke_user_keys('99999999-0000-4000-a000-000000000009','aaaaaaaa-0000-4000-a000-000000000001','lo key tren github')::text$$), '1');
select t.check('A không còn key active', (select count(*)::text from api_keys where user_id = :A and revoked_at is null), '0');
select t.check('audit revoke_keys có payload revoked=1', (select payload::text from admin_audit_log where action = 'revoke_keys'), '{"revoked": 1}');
select t.check('thu hồi lần 2 -> 0, vẫn ghi audit', t.val('service_role', null,
  $$select admin_revoke_user_keys('99999999-0000-4000-a000-000000000009','aaaaaaaa-0000-4000-a000-000000000001','kiem tra lai')::text$$), '0');

-- ===== audit append-only + sống sau khi xoá user
select t.check('service_role không sửa audit', t.state('service_role', null, $$update admin_audit_log set reason = 'sua lich su'$$), '42501');
select t.check('service_role không xoá audit', t.state('service_role', null, $$delete from admin_audit_log$$), '42501');
select t.check('admin_list_audit theo A: 5 dòng, mới nhất trước', t.val('service_role', null,
  $$select string_agg(action, ',') from admin_list_audit('aaaaaaaa-0000-4000-a000-000000000001')$$), 'revoke_keys,revoke_keys,view_user,unsuspend,suspend');
delete from auth.users where id = :A;
select t.check('xoá user A -> audit vẫn còn', (select count(*)::text from admin_audit_log where target_user_id = :A), '5');

-- ===== bổ sung sau mutation testing (dùng B: A đã xoá ở trên, tin/FK của A không còn)
create or replace function t.msg(role_name text, uid uuid, stmt text) returns text language plpgsql as $$
declare got text := 'ok';
begin
  execute format('set local role %I', role_name);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  begin execute stmt; exception when others then got := sqlerrm; end;
  reset role;
  return got;
end $$;

-- EXECUTE thật sự (ca 42501 ở trên có thể đến từ quyền BẢNG chứ không phải EXECUTE): 6 hàm chỉ service_role, INVOKER.
select t.check('7 hàm admin + authenticate_api_key: INVOKER, chỉ service_role có EXECUTE', (select
  (count(*) = 7 and count(*) filter (where p.prosecdef
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or not has_function_privilege('service_role', p.oid, 'EXECUTE')) = 0)::text
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('admin_user_stats','admin_user_keys','admin_set_suspended','admin_revoke_user_keys','admin_list_audit','admin_log_view','authenticate_api_key')), 'true');

-- Chữ ký cột: thêm cột (vd nội dung giao dịch, key_hash) là vỡ ngay.
select t.check('admin_user_stats: đúng 8 cột, không cột nội dung', pg_get_function_result('public.admin_user_stats(uuid[])'::regprocedure),
  'TABLE(user_id uuid, suspended_at timestamp with time zone, suspended_reason text, consent_at timestamp with time zone, keys_active integer, keys_last_used_at timestamp with time zone, tx_count_30d integer, unparsed_30d jsonb)');
select t.check('admin_user_keys: không trả key_hash', pg_get_function_result('public.admin_user_keys(uuid)'::regprocedure),
  'TABLE(id uuid, name text, prefix text, last4 text, created_at timestamp with time zone, last_used_at timestamp with time zone, revoked_at timestamp with time zone)');
select t.check('admin_list_audit: đúng cột audit', pg_get_function_result('public.admin_list_audit(uuid,integer,integer)'::regprocedure),
  'TABLE(id bigint, admin_id uuid, action text, target_user_id uuid, reason text, payload jsonb, created_at timestamp with time zone)');

select t.check('admin_audit_log bật RLS (lớp dự phòng nếu lỡ grant)', (select relrowsecurity::text from pg_class where oid = 'public.admin_audit_log'::regclass), 'true');

-- stats theo mảng id: chỉ đúng user yêu cầu (không dựa vào thứ tự hàng)
select t.check('stats theo p_user_ids chỉ trả đúng 1 user', t.val('service_role', null,
  $$select count(*)::text from admin_user_stats(array['bbbbbbbb-0000-4000-a000-000000000002'::uuid])$$), '1');

-- tin unparsed > 30 ngày không được đếm
insert into unparsed_messages(user_id, raw_text, reason, received_at) values
  ('bbbbbbbb-0000-4000-a000-000000000002', 'TIN CU 40 NGAY', 'no_match', now() - interval '40 days');
select t.check('tin unparsed quá 30 ngày không vào stats', t.val('service_role', null,
  $$select unparsed_30d::text from admin_user_stats(array['bbbbbbbb-0000-4000-a000-000000000002'::uuid])$$), '{}');

-- lọc audit theo user
select t.check('admin_set_suspended(B) ghi audit cho B', t.state('service_role', null,
  $$select admin_set_suspended('99999999-0000-4000-a000-000000000009','bbbbbbbb-0000-4000-a000-000000000002', true, 'thu nghiem loc audit')$$), 'ok');
select t.check('admin_list_audit(B) chỉ trả dòng của B', t.val('service_role', null,
  $$select count(*)::text || '|' || bool_and(target_user_id = 'bbbbbbbb-0000-4000-a000-000000000002'::uuid)::text from admin_list_audit('bbbbbbbb-0000-4000-a000-000000000002'::uuid)$$), '1|true');
select t.check('admin_list_audit(A đã xoá) vẫn đúng 5 dòng, không lẫn B', t.val('service_role', null,
  $$select count(*)::text from admin_list_audit('aaaaaaaa-0000-4000-a000-000000000001'::uuid)$$), '5');

-- khoá lại user đang khoá: giữ mốc thời gian cũ, cập nhật lý do
create temp table mark as select suspended_at as t1 from user_settings where user_id = 'bbbbbbbb-0000-4000-a000-000000000002';
select t.check('khoá lại user đang khoá: ok', t.state('service_role', null,
  $$select admin_set_suspended('99999999-0000-4000-a000-000000000009','bbbbbbbb-0000-4000-a000-000000000002', true, 'khoa lan hai')$$), 'ok');
select t.check('... mốc suspended_at giữ nguyên, lý do hiển thị là lần khoá mới nhất', (select
  (us.suspended_at = m.t1 and st.suspended_reason = 'khoa lan hai')::text
  from user_settings us, mark m, admin_user_stats(array['bbbbbbbb-0000-4000-a000-000000000002'::uuid]) st
  where us.user_id = 'bbbbbbbb-0000-4000-a000-000000000002'), 'true');

-- ranh giới lý do: 500 được nhận, 501 -> 23514
select t.check('lý do đúng 500 ký tự được nhận', t.state('service_role', null, format($$select admin_set_suspended('99999999-0000-4000-a000-000000000009','bbbbbbbb-0000-4000-a000-000000000002', true, %L)$$, repeat('x', 500))), 'ok');
select t.check('lý do 501 ký tự -> 23514', t.state('service_role', null, format($$select admin_set_suspended('99999999-0000-4000-a000-000000000009','bbbbbbbb-0000-4000-a000-000000000002', true, %L)$$, repeat('x', 501))), '23514');

-- thu hồi key của user không tồn tại
select t.check('revoke user lạ -> P0002', t.state('service_role', null,
  $$select admin_revoke_user_keys('99999999-0000-4000-a000-000000000009','cccccccc-0000-4000-a000-000000000003','lam dung api')$$), 'P0002');
select t.check('... và không ghi audit cho user lạ', (select count(*)::text from admin_audit_log where target_user_id = 'cccccccc-0000-4000-a000-000000000003'), '0');

-- trần 200 dòng + limit tối thiểu 1
insert into admin_audit_log(admin_id, action, target_user_id, reason)
  select '99999999-0000-4000-a000-000000000009', 'unsuspend', 'bbbbbbbb-0000-4000-a000-000000000002', 'nap de thu tran' from generate_series(1, 210);
select t.check('admin_list_audit: trần 200 dòng', t.val('service_role', null, $$select count(*)::text from admin_list_audit(null, 1000, 0)$$), '200');
select t.check('admin_list_audit: limit 0 -> 1 dòng, offset âm không lỗi', t.val('service_role', null, $$select count(*)::text from admin_list_audit(null, 0, -5)$$), '1');

-- trigger append-only là lớp thứ hai: thử khi service_role ĐÃ có UPDATE/DELETE (grant thu hồi ngay sau)
grant update, delete on public.admin_audit_log to service_role;
select t.check('trigger chặn UPDATE dù service_role có quyền', t.msg('service_role', null, $$update admin_audit_log set reason = 'sua lich su'$$), 'admin_audit_log là append-only');
select t.check('trigger chặn DELETE dù service_role có quyền', t.msg('service_role', null, $$delete from admin_audit_log$$), 'admin_audit_log là append-only');
revoke update, delete on public.admin_audit_log from service_role;

select t.check('trigger chặn TRUNCATE', t.msg('postgres', null, $$truncate admin_audit_log$$), 'admin_audit_log là append-only');
select t.check('7 bảng dữ liệu có policy restrictive not_suspended, user_settings không', (select
  (count(*) = 7 and bool_and(polpermissive = false))::text from pg_policy where polname = 'not_suspended'), 'true');

-- 20261029100000: anon không EXECUTE được function nào của public (PUBLIC mặc định có EXECUTE)
select t.check('anon không gọi được function nào trong public', (select coalesce(string_agg(p.proname, ',' order by p.proname), '')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')), '');  -- bỏ function của extension
create function public.zz_new_rpc() returns int language sql as 'select 1';
select t.check('function tạo sau migration không tự mở cho anon', has_function_privilege('anon', 'public.zz_new_rpc()', 'execute')::text, 'false');
drop function public.zz_new_rpc();
