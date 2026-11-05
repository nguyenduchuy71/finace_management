-- Phase 4 SaaS: xoá nguyên văn thông báo sau N ngày + số liệu tỉ lệ parse theo bank.
--
-- 1. purge_raw_text(p_days): transactions.raw_text -> NULL; với tin hộp tin ĐÃ resolved: raw_text -> '' (cột NOT NULL,
--    mapper Zod đọc string) và parsed_payload -> NULL. KHÔNG đụng tin chưa resolved: tin no_credit đang treo cần
--    parsed_payload để phát lại, tin lạ còn chờ user phân loại cần raw_text.
--    Không ảnh hưởng chống trùng (cửa sổ 10 phút ≪ 30 ngày) và backfill-unparsed (chỉ đọc tin CHƯA resolved).
-- 2. parse_rate_by_source: view chỉ cho SQL/service_role (không UI).
-- 3. pg_cron: lịch hằng ngày 03:00 ICT (= 20:00 UTC) NẾU extension có sẵn. Thiếu thì bỏ qua (không fail migration);
--    production bật pg_cron trong Dashboard (Database -> Extensions) rồi chạy lại khối cron ở cuối file.

-- ---------------------------------------------------------------------------
-- 1. purge_raw_text
-- ---------------------------------------------------------------------------
-- service_role cần quyền cột tường minh (authenticated/anon không có đường nào tới hàm này).
grant select, update on public.transactions, public.unparsed_messages to service_role;

create or replace function public.purge_raw_text(p_days int default 30)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  c_batch constant int := 1000;
  v_cutoff timestamptz;
  v_n int;
  v_tx int := 0;
  v_msg int := 0;
begin
  if p_days is null or p_days < 1 then
    raise exception 'p_days phải >= 1' using errcode = '22023';
  end if;
  v_cutoff := now() - make_interval(days => p_days);

  -- Theo lô để mỗi câu UPDATE ngắn; skip locked để không chờ dòng đang được ingest/resolve giữ.
  loop
    update public.transactions set raw_text = null
     where id in (select id from public.transactions
                   where raw_text is not null and created_at < v_cutoff
                   order by created_at limit c_batch for update skip locked);
    get diagnostics v_n = row_count;
    v_tx := v_tx + v_n;
    exit when v_n < c_batch;
  end loop;

  loop
    update public.unparsed_messages set raw_text = '', parsed_payload = null
     where id in (select id from public.unparsed_messages
                   where resolved and received_at < v_cutoff
                     and (raw_text <> '' or parsed_payload is not null)
                   order by received_at limit c_batch for update skip locked);
    get diagnostics v_n = row_count;
    v_msg := v_msg + v_n;
    exit when v_n < c_batch;
  end loop;

  return jsonb_build_object('transactions', v_tx, 'unparsed_messages', v_msg);
end;
$$;

revoke all on function public.purge_raw_text(int) from public, anon, authenticated;
grant execute on function public.purge_raw_text(int) to service_role;

comment on function public.purge_raw_text(int) is
  'Xoá raw_text giao dịch và raw_text/parsed_payload của tin ĐÃ resolved cũ hơn p_days ngày. Không đụng tin chưa resolved. Chỉ service_role/postgres.';

-- ---------------------------------------------------------------------------
-- 2. parse_rate_by_source
-- ---------------------------------------------------------------------------
-- Mỗi (cửa sổ 7/30 ngày, bank): inserted = giao dịch ghi được (kể cả tin treo đã phát lại), trừ giao dịch do user tự
-- tạo từ hộp tin (tin reason <> 'no_credit' trỏ tới nó — parser đã thất bại ở tin đó). held = tin no_credit CHƯA phát lại.
-- Bank lấy từ transactions.bank_name / unparsed_messages.source (so khớp không phân biệt hoa thường).
-- parse_rate = inserted / tổng; null khi không có dữ liệu.
create or replace view public.parse_rate_by_source
with (security_invoker = true) as
with w(days) as (values (7), (30)),
ins as (
  select w.days, lower(t.bank_name) as src, count(*) as n
    from w
    join public.transactions t on t.created_at >= now() - make_interval(days => w.days)
   where not exists (select 1 from public.unparsed_messages u
                      where u.transaction_id = t.id and u.reason is distinct from 'no_credit')
   group by 1, 2
),
fail as (
  select w.days, lower(coalesce(u.source, 'unknown')) as src,
         count(*) filter (where u.reason = 'no_credit' and not u.resolved) as held,
         count(*) filter (where u.reason = 'no_match') as no_match,
         count(*) filter (where u.reason in ('invalid_parse', 'invalid_payload')) as invalid,
         count(*) filter (where u.reason = 'no_account') as no_account
    from w
    join public.unparsed_messages u on u.received_at >= now() - make_interval(days => w.days)
   group by 1, 2
),
keys as (select days, src from ins union select days, src from fail)
select k.days as window_days, k.src as source,
       coalesce(i.n, 0)::int as inserted,
       coalesce(f.held, 0)::int as held,
       coalesce(f.no_match, 0)::int as no_match,
       coalesce(f.invalid, 0)::int as invalid,
       coalesce(f.no_account, 0)::int as no_account,
       round(coalesce(i.n, 0)::numeric * 100
             / nullif(coalesce(i.n, 0) + coalesce(f.held, 0) + coalesce(f.no_match, 0)
                      + coalesce(f.invalid, 0) + coalesce(f.no_account, 0), 0), 1) as parse_rate_pct
  from keys k
  left join ins i on i.days = k.days and i.src = k.src
  left join fail f on f.days = k.days and f.src = k.src;

revoke all on public.parse_rate_by_source from public, anon, authenticated;
grant select on public.parse_rate_by_source to service_role;

comment on view public.parse_rate_by_source is
  'Tỉ lệ parse theo bank, cửa sổ 7/30 ngày. Chỉ SQL/service_role (RLS user không đủ vì cần đếm toàn bộ user).';

-- ---------------------------------------------------------------------------
-- 3. Lịch pg_cron (chỉ khi extension có sẵn)
-- ---------------------------------------------------------------------------
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-raw-text', '0 20 * * *', 'select public.purge_raw_text(30)');
  else
    raise notice 'pg_cron không có sẵn: bỏ qua lịch purge-raw-text (bật ở production, xem docs/claude/database-schema.md)';
  end if;
exception when others then
  raise notice 'Không đặt được lịch pg_cron (%): chạy tay khối cron sau khi bật extension', sqlerrm;
end
$cron$;
