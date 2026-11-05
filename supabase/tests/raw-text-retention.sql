-- Kiểm tra migration 20261102100000_raw_text_retention_parse_metrics.sql (purge_raw_text + parse_rate_by_source).
--
-- Chạy trên Postgres 17 TẠM (giống admin-rls.sql), không đụng stack Supabase đang chạy:
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -f - < supabase/tests/raw-text-retention.sql | grep -E "PASS|FAIL|ERROR"
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
create or replace function t.val(q text) returns text language plpgsql as $$
declare r text; begin execute q into r; return r; end $$;
create or replace function t.check(label text, got text, want text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: want [%] got [%]', label, want, got; end if;
  raise notice 'PASS %', label;
end $$;

insert into auth.users (id, raw_user_meta_data) values ('aaaaaaaa-0000-4000-a000-00000000000a', null);

-- Giao dịch: cũ (40 ngày), mới (5 ngày).
insert into transactions (id, user_id, bank_name, amount, transaction_date, description, source_type, raw_text, created_at) values
 ('00000000-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-00000000000a','OCB',-1000,now(),'cu','credit_card','RAW OLD', now() - interval '40 days'),
 ('00000000-0000-4000-b000-000000000002','aaaaaaaa-0000-4000-a000-00000000000a','OCB',-2000,now(),'moi','credit_card','RAW NEW', now() - interval '5 days');

-- Hộp tin: resolved cũ / resolved mới / chưa resolved cũ (no_match) / treo no_credit cũ có parsed_payload.
insert into unparsed_messages (id, user_id, raw_text, source, reason, resolved, kind, received_at, parsed_payload) values
 ('00000000-0000-4000-c000-000000000001','aaaaaaaa-0000-4000-a000-00000000000a','MSG RESOLVED OLD','OCB','no_match',true,'promo', now() - interval '40 days','{"x":1}'),
 ('00000000-0000-4000-c000-000000000002','aaaaaaaa-0000-4000-a000-00000000000a','MSG RESOLVED NEW','OCB','no_match',true,'promo', now() - interval '5 days','{"x":1}'),
 ('00000000-0000-4000-c000-000000000003','aaaaaaaa-0000-4000-a000-00000000000a','MSG OPEN OLD','OCB','no_match',false,null, now() - interval '40 days',null),
 ('00000000-0000-4000-c000-000000000004','aaaaaaaa-0000-4000-a000-00000000000a','MSG HELD OLD','OCB','no_credit',false,null, now() - interval '40 days','{"tx":{"amount":-5}}');

-- Quyền: authenticated/anon không gọi được purge, không đọc được view; service_role gọi được.
select t.check('anon cannot execute purge', t.state('anon', null, 'select purge_raw_text(30)'), '42501');
select t.check('authenticated cannot execute purge', t.state('authenticated', 'aaaaaaaa-0000-4000-a000-00000000000a', 'select purge_raw_text(30)'), '42501');
select t.check('anon cannot read metrics', t.state('anon', null, 'select * from parse_rate_by_source'), '42501');
select t.check('authenticated cannot read metrics', t.state('authenticated', 'aaaaaaaa-0000-4000-a000-00000000000a', 'select * from parse_rate_by_source'), '42501');
select t.check('service_role can read metrics', t.state('service_role', null, 'select * from parse_rate_by_source'), 'ok');
select t.check('p_days < 1 rejected', t.state('service_role', null, 'select purge_raw_text(0)'), '22023');

-- Metrics trước khi purge: cửa sổ 30 ngày, OCB: 1 giao dịch ghi (cũ 40 ngày ngoài cửa sổ -> chỉ giao dịch mới), 2 no_match
-- (resolved mới + ... tin cũ 40 ngày ngoài cửa sổ) -> kiểm bằng số cụ thể ở cửa sổ 7 ngày.
select t.check('metrics 7d inserted', t.val($q$select inserted::text from parse_rate_by_source where window_days=7 and source='ocb'$q$), '1');
select t.check('metrics 7d no_match', t.val($q$select no_match::text from parse_rate_by_source where window_days=7 and source='ocb'$q$), '1');
select t.check('metrics 7d rate', t.val($q$select parse_rate_pct::text from parse_rate_by_source where window_days=7 and source='ocb'$q$), '50.0');
select t.check('metrics 30d held 0 (held old is 40d)', t.val($q$select held::text from parse_rate_by_source where window_days=30 and source='ocb'$q$), '0');

-- Purge (service_role).
select t.check('purge counts', t.val($q$select (public.purge_raw_text(30))::text$q$), '{"transactions": 1, "unparsed_messages": 1}');
select t.check('old tx purged', t.val($q$select (raw_text is null)::text from transactions where id='00000000-0000-4000-b000-000000000001'$q$), 'true');
select t.check('recent tx untouched', t.val($q$select raw_text from transactions where id='00000000-0000-4000-b000-000000000002'$q$), 'RAW NEW');
select t.check('old resolved msg purged raw', t.val($q$select raw_text from unparsed_messages where id='00000000-0000-4000-c000-000000000001'$q$), '');
select t.check('old resolved msg purged payload', t.val($q$select (parsed_payload is null)::text from unparsed_messages where id='00000000-0000-4000-c000-000000000001'$q$), 'true');
select t.check('old resolved keeps kind', t.val($q$select kind from unparsed_messages where id='00000000-0000-4000-c000-000000000001'$q$), 'promo');
select t.check('recent resolved untouched', t.val($q$select raw_text||(parsed_payload is not null)::text from unparsed_messages where id='00000000-0000-4000-c000-000000000002'$q$), 'MSG RESOLVED NEWtrue');
select t.check('unresolved old untouched', t.val($q$select raw_text from unparsed_messages where id='00000000-0000-4000-c000-000000000003'$q$), 'MSG OPEN OLD');
select t.check('held no_credit untouched raw', t.val($q$select raw_text from unparsed_messages where id='00000000-0000-4000-c000-000000000004'$q$), 'MSG HELD OLD');
select t.check('held no_credit untouched payload', t.val($q$select (parsed_payload is not null)::text from unparsed_messages where id='00000000-0000-4000-c000-000000000004'$q$), 'true');
select t.check('idempotent second purge', t.val($q$select (public.purge_raw_text(30))::text$q$), '{"transactions": 0, "unparsed_messages": 0}');

-- Batching: 2500 giao dịch cũ + 2300 tin resolved cũ -> một lần gọi xoá hết (3 lô), service_role chạy được.
insert into transactions (user_id, bank_name, amount, transaction_date, description, source_type, raw_text, created_at)
select 'aaaaaaaa-0000-4000-a000-00000000000a','OCB',-1,now(),'b','credit_card','B'||g, now() - interval '50 days' from generate_series(1,2500) g;
insert into unparsed_messages (user_id, raw_text, source, reason, resolved, kind, received_at, parsed_payload)
select 'aaaaaaaa-0000-4000-a000-00000000000a','M'||g,'OCB','no_match',true,'promo', now() - interval '50 days','{"a":1}' from generate_series(1,2300) g;
select t.check('service_role can execute purge', t.state('service_role', null, 'select purge_raw_text(30)'), 'ok');
select t.check('batched: no old tx left', t.val($q$select count(*)::text from transactions where raw_text is not null and created_at < now() - interval '30 days'$q$), '0');
select t.check('batched: no old resolved msg left', t.val($q$select count(*)::text from unparsed_messages where resolved and received_at < now() - interval '30 days' and (raw_text <> '' or parsed_payload is not null)$q$), '0');
select t.check('batched: held still untouched', t.val($q$select raw_text from unparsed_messages where id='00000000-0000-4000-c000-000000000004'$q$), 'MSG HELD OLD');
