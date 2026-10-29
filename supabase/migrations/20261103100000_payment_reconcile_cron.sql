-- Lịch đối soát thanh toán: Supabase Cron (pg_cron) gọi edge function `payment-reconcile` mỗi 5 phút qua pg_net.
--
-- URL + secret đọc từ Supabase Vault LÚC CHẠY (vault.decrypted_secrets: payment_reconcile_url, payment_reconcile_secret):
-- không secret nào nằm trong migration hay trong câu lệnh của job (cron.job.command là text thường).
-- Thiếu extension / vault / secret thì hàm trả sớm và KHÔNG làm gì (không lỗi, không spam cron.job_run_details).
-- Production: bật pg_cron + pg_net (Dashboard -> Database -> Extensions), tạo 2 secret (docs/claude/testing-and-deployment.md),
-- rồi chạy lại khối `do` ở cuối file (hoặc đúng dòng cron.schedule).

-- Trả: 'skipped:no_pg_net' | 'skipped:no_vault' | 'skipped:no_secret' | 'sent'.
-- Tên kiểm bằng to_regclass / to_regprocedure nên hàm tạo được cả khi chưa có vault/pg_net (Postgres trần).
create or replace function public.invoke_payment_reconcile()
returns text
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return 'skipped:no_pg_net';
  end if;
  if to_regclass('vault.decrypted_secrets') is null then
    return 'skipped:no_vault';
  end if;

  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'payment_reconcile_url'    limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'payment_reconcile_secret' limit 1;
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return 'skipped:no_secret';
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reconcile-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  return 'sent';
end;
$$;

-- Chỉ job cron (chạy bằng owner = postgres) và service_role; authenticated/anon không được đọc vault qua đây.
revoke all on function public.invoke_payment_reconcile() from public, anon, authenticated;
grant execute on function public.invoke_payment_reconcile() to service_role;

comment on function public.invoke_payment_reconcile() is
  'Gọi payment-reconcile qua pg_net với URL/secret từ Vault; trả sớm nếu thiếu extension/vault/secret. Chỉ cron/service_role.';

-- ---------------------------------------------------------------------------
-- Lịch pg_cron: cần pg_cron + pg_net + schema vault. Thiếu -> notice rồi bỏ qua (không fail migration).
-- ---------------------------------------------------------------------------
do $cron$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron hoặc pg_net không có sẵn: bỏ qua lịch payment-reconcile (bật ở production rồi chạy lại khối này)';
    return;
  end if;
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'Chưa có schema vault: bỏ qua lịch payment-reconcile (bật supabase_vault rồi chạy lại khối này)';
    return;
  end if;
  perform cron.schedule('payment-reconcile', '*/5 * * * *', 'select public.invoke_payment_reconcile()');
exception when others then
  raise notice 'Không đặt được lịch payment-reconcile (%): chạy tay khối cron sau khi bật extension', sqlerrm;
end
$cron$;
