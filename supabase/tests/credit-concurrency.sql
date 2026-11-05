-- Kiểm tra TRANH CHẤP của ingest_transaction / replay_held_messages / _apply_credit (migration 20261030100000).
-- Cần NHIỀU session thật chạy song song nên có 3 giai đoạn (stage=setup, các session song song, stage=assert).
--
--   docker run -d --rm --name scratch-pg17 -e POSTGRES_PASSWORD=x postgres:17-alpine
--   (chờ ~6s)
--   P="docker exec -i scratch-pg17 psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/scratch-stub.sql
--   for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 < $f; done
--   $P -v stage=setup -f - < supabase/tests/credit-concurrency.sql
--   # ing <user> <raw_text> <card_id>: SQL gọi ingest_transaction (psql -c không nội suy biến nên dựng chuỗi bằng bash)
--   ing() { echo "select ingest_transaction('$1', jsonb_build_object('bank_name','OCB','amount',-1000,'transaction_date','2026-10-30T10:00:00+07:00','raw_text','$2','source_type','credit_card'), '{\"card_id\":\"$3\"}'::jsonb, 't')"; }
--   # S1: phiên 1 giữ khoá số dư 2s trong transaction, phiên 2 đến sau 0.7s phải CHỜ rồi thấy số dư 0
--   C=cccccccc-0000-4000-a000-000000000003 ; CC=cccccccc-1111-4000-a000-000000000001
--   ( { echo "begin;"; echo "$(ing $C c1 $CC);"; echo "select pg_sleep(2);"; echo "commit;"; } | $P & \
--     sleep 0.7; ing $C c2 $CC | $P; wait )
--   # S2: 6 session song song, số dư 1 | S3: 4 session áp cùng 1 ref | S4: unlimited 5 session | S5: 2 replay song song
--   D=dddddddd-0000-4000-a000-000000000004 ; CD=dddddddd-1111-4000-a000-000000000001
--   for i in 1 2 3 4 5 6; do ing $D d$i $CD | $P & done; wait
--   E=eeeeeeee-0000-4000-a000-000000000005
--   for i in 1 2 3 4; do $P -c "select _apply_credit('$E', 7, 'grant', 'dup:e')" & done; wait
--   F=ffffffff-0000-4000-a000-000000000006 ; CF=ffffffff-1111-4000-a000-000000000001
--   for i in 1 2 3 4 5; do ing $F f$i $CF | $P & done; wait
--   $P -c "select _apply_credit('11111111-0000-4000-a000-000000000007', 3, 'purchase', 'order:g')"
--   for i in 1 2; do $P -c "select replay_held_messages('11111111-0000-4000-a000-000000000007')" & done; wait
--   $P -v stage=assert -f - < supabase/tests/credit-concurrency.sql | grep -E "PASS|FAIL|ERROR"
--   docker rm -f scratch-pg17
-- Phiên bị CHECK/lỗi in ERROR ra stderr khi chạy song song: là dấu hiệu khoá hỏng (ingest đúng thì mọi phiên đều thành công).
\set ON_ERROR_STOP on
select :'stage' = 'setup' as is_setup \gset
\if :is_setup
  -- Mỗi user: ví + 1 thẻ. C, D: số dư 1. G: 3 tin treo (số dư 0). F: unlimited, số dư 0.
  insert into auth.users values
    ('cccccccc-0000-4000-a000-000000000003', null), ('dddddddd-0000-4000-a000-000000000004', null),
    ('eeeeeeee-0000-4000-a000-000000000005', null), ('ffffffff-0000-4000-a000-000000000006', null),
    ('11111111-0000-4000-a000-000000000007', null);
  insert into credit_cards(id,user_id,bank_name,card_name,card_number,card_type,statement_date,payment_due_date)
    select (left(u::text, 8) || '-1111-4000-a000-000000000001')::uuid, u, 'OCB', 'x', '****9586', 'visa', 5, 25
    from unnest(array['cccccccc-0000-4000-a000-000000000003','dddddddd-0000-4000-a000-000000000004',
                      'ffffffff-0000-4000-a000-000000000006','11111111-0000-4000-a000-000000000007']::uuid[]) u;
  select _apply_credit(u, -99, 'adjust', 'setup:' || u) from unnest(array['cccccccc-0000-4000-a000-000000000003',
    'dddddddd-0000-4000-a000-000000000004']::uuid[]) u;
  select _apply_credit(u, -100, 'adjust', 'setup:' || u) from unnest(array['ffffffff-0000-4000-a000-000000000006',
    '11111111-0000-4000-a000-000000000007']::uuid[]) u;
  update credit_balances set unlimited = true where user_id = 'ffffffff-0000-4000-a000-000000000006';
  insert into unparsed_messages(user_id, raw_text, reason, parsed_payload, received_at)
    select '11111111-0000-4000-a000-000000000007', 'RAW g' || g, 'no_credit',
      jsonb_build_object('tx', jsonb_build_object('bank_name','OCB','amount',-1000,'transaction_date','2026-10-30T10:00:00+07:00',
        'raw_text','RAW g' || g,'source_type','credit_card'),
        'refs', jsonb_build_object('card_id','11111111-1111-4000-a000-000000000001')),
      now() - make_interval(mins => 10 - g)
    from generate_series(1, 3) g;
  select 'setup xong' as ok;
\else
  create schema if not exists t;
  create or replace function t.check(label text, got text, want text) returns void language plpgsql as $$
  begin
    if got is distinct from want then raise exception 'FAIL %: want [%] got [%]', label, want, got; end if;
    raise notice 'PASS %', label;
  end $$;
  create or replace function t.n(sql text) returns text language plpgsql as $$
  declare r text; begin execute sql into r; return r; end $$;

  -- S1: phiên 2 đến lúc phiên 1 còn giữ khoá -> phải chờ, thấy số dư 0 -> giữ tin (không ghi 2, không lỗi âm)
  select t.check('S1: 1 giao dịch ghi (c1), c2 bị giữ, số dư 0', t.n($$
    select (select count(*) from transactions where user_id = 'cccccccc-0000-4000-a000-000000000003')
     || '|' || (select string_agg(raw_text, ',') from transactions where user_id = 'cccccccc-0000-4000-a000-000000000003')
     || '|' || (select count(*) from unparsed_messages where user_id = 'cccccccc-0000-4000-a000-000000000003' and reason = 'no_credit')
     || '|' || (select raw_text from unparsed_messages where user_id = 'cccccccc-0000-4000-a000-000000000003' and reason = 'no_credit')
     || '|' || (select balance from credit_balances where user_id = 'cccccccc-0000-4000-a000-000000000003')$$), '1|c1|1|c2|0');
  -- S2
  select t.check('S2: 6 session song song, số dư 1 -> đúng 1 ghi + 5 giữ, số dư 0', t.n($$
    select (select count(*) from transactions where user_id = 'dddddddd-0000-4000-a000-000000000004')
     || '|' || (select count(*) from unparsed_messages where user_id = 'dddddddd-0000-4000-a000-000000000004' and reason = 'no_credit')
     || '|' || (select count(*) from credit_ledger where user_id = 'dddddddd-0000-4000-a000-000000000004' and kind = 'usage')
     || '|' || (select balance from credit_balances where user_id = 'dddddddd-0000-4000-a000-000000000004')$$), '1|5|1|0');
  -- S3: cùng ref áp 1 lần dù 4 session cùng lúc
  select t.check('S3: 4 session áp cùng ref -> cộng đúng 1 lần (100 + 7)', t.n($$
    select (select balance from credit_balances where user_id = 'eeeeeeee-0000-4000-a000-000000000005')
     || '|' || (select count(*) from credit_ledger where ref = 'dup:e')$$), '107|1');
  -- S4: unlimited
  select t.check('S4: unlimited, 5 session -> 5 ghi, 0 giữ, không dòng usage, số dư 0', t.n($$
    select (select count(*) from transactions where user_id = 'ffffffff-0000-4000-a000-000000000006')
     || '|' || (select count(*) from unparsed_messages where user_id = 'ffffffff-0000-4000-a000-000000000006')
     || '|' || (select count(*) from credit_ledger where user_id = 'ffffffff-0000-4000-a000-000000000006' and kind = 'usage')
     || '|' || (select balance from credit_balances where user_id = 'ffffffff-0000-4000-a000-000000000006')$$), '5|0|0|0');
  -- S5: 2 replay song song, 3 credit, 3 tin treo -> tổng đúng 3 giao dịch (không ghi đôi), 3 usage, số dư 0
  select t.check('S5: 2 replay song song -> đúng 3 giao dịch, 3 usage, số dư 0, hết tin treo', t.n($$
    select (select count(*) from transactions where user_id = '11111111-0000-4000-a000-000000000007')
     || '|' || (select count(*) from credit_ledger where user_id = '11111111-0000-4000-a000-000000000007' and kind = 'usage')
     || '|' || (select balance from credit_balances where user_id = '11111111-0000-4000-a000-000000000007')
     || '|' || (select count(*) from unparsed_messages where user_id = '11111111-0000-4000-a000-000000000007' and not resolved)$$), '3|3|0|0');
  select t.check('S5: FIFO — tin g1 gắn giao dịch tạo trước tin g3', t.n($$
    select (select x1.created_at <= x3.created_at from unparsed_messages u1 join transactions x1 on x1.id = u1.transaction_id,
                 unparsed_messages u3 join transactions x3 on x3.id = u3.transaction_id
             where u1.raw_text = 'RAW g1' and u3.raw_text = 'RAW g3')::text$$), 'true');
  select t.check('bất biến: balance = sum(delta) cho MỌI user', t.n($$
    select count(*) from credit_balances b
    where b.balance <> coalesce((select sum(delta) from credit_ledger l where l.user_id = b.user_id), 0)$$), '0');
\endif
