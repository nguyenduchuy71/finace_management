-- Sửa theo review commit 718f10b (tab admin "Đơn thanh toán" + cron đối soát).
--
-- M1  admin_resolve_order nhận mã giao dịch của ví: đơn chưa có provider_tx_id mà đánh dấu paid thì BẮT BUỘC có mã
--     (không có thì IPN muộn mang tx_id thật tới vẫn qua được 'duplicate' check và dễ cộng lần 2 ở đơn khác);
--     ràng buộc unique (provider, provider_tx_id) cũ vẫn giữ -> mã đã dùng ở đơn khác = 23505.
-- M2  invoke_payment_reconcile ghi từng kết quả vào payment_events (source 'reconcile'); admin_reconcile_status trả
--     kết quả gần nhất + số đơn pending kẹt để UI cảnh báo khi cron chết / thiếu secret.
-- L1  admin_order_owner: edge function tra chủ đơn để từ chối đơn của admin khác (auth.users không đọc được từ RPC).

-- ---------------------------------------------------------------------------
-- M2. payment_events nhận 'reconcile'
-- ---------------------------------------------------------------------------
alter table public.payment_events drop constraint if exists payment_events_source_check;
alter table public.payment_events add constraint payment_events_source_check
  check (source in ('create', 'ipn', 'query', 'reconcile'));

-- Trả: 'skipped:no_pg_net' | 'skipped:no_vault' | 'skipped:no_secret' | 'sent'. Mỗi lần gọi ghi 1 dòng payment_events
-- (provider/source 'reconcile', result = kết quả, payload chỉ có request_id của pg_net — KHÔNG URL, KHÔNG secret).
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
  v_out    text;
  v_req    bigint;
begin
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    v_out := 'skipped:no_pg_net';
  elsif to_regclass('vault.decrypted_secrets') is null then
    v_out := 'skipped:no_vault';
  else
    select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'payment_reconcile_url'    limit 1;
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'payment_reconcile_secret' limit 1;
    if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
      v_out := 'skipped:no_secret';
    else
      v_req := net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-reconcile-secret', v_secret),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );
      v_out := 'sent';
    end if;
  end if;

  insert into public.payment_events (provider, source, result, payload)
  values ('reconcile', 'reconcile', v_out,
          case when v_req is null then '{}'::jsonb else jsonb_build_object('request_id', v_req) end);
  return v_out;
end;
$$;

-- Kết quả đối soát gần nhất + đơn pending kẹt (> 15 phút chưa được hỏi provider trong 15 phút gần đây).
-- last_http_status: status_code của request pg_net (net._http_response) nếu đọc được; null = chưa có phản hồi / không đọc được.
create or replace function public.admin_reconcile_status()
returns table (last_outcome text, last_at timestamptz, last_http_status int, stale_pending bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_out text; v_at timestamptz; v_req bigint; v_http int; v_stale bigint;
begin
  select e.result, e.received_at, nullif(e.payload ->> 'request_id', '')::bigint
    into v_out, v_at, v_req
    from public.payment_events e where e.source = 'reconcile' order by e.id desc limit 1;

  if v_req is not null then
    begin
      -- to_regclass cũng ném 42501 khi không có USAGE trên schema net -> nằm trong khối bắt lỗi.
      if to_regclass('net._http_response') is not null then
        execute 'select status_code from net._http_response where id = $1' into v_http using v_req;
      end if;
    exception when others then
      v_http := null;   -- service_role không có quyền đọc net._http_response: bỏ qua, không làm hỏng trang
    end;
  end if;

  select count(*) into v_stale from public.payment_orders o
   where o.status = 'pending'
     and o.created_at < now() - interval '15 minutes'
     and (o.last_checked_at is null or o.last_checked_at < now() - interval '15 minutes');

  return query select v_out, v_at, v_http, v_stale;
end;
$$;

-- ---------------------------------------------------------------------------
-- L1. Chủ đơn (null = không có đơn)
-- ---------------------------------------------------------------------------
create or replace function public.admin_order_owner(p_order uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select user_id from public.payment_orders where id = p_order;
$$;

-- ---------------------------------------------------------------------------
-- M1. admin_resolve_order + mã giao dịch
-- ---------------------------------------------------------------------------
drop function if exists public.admin_resolve_order(uuid, uuid, text, text);

-- Lỗi: 22023 option lạ / mark_paid thiếu hoặc sai mã giao dịch | P0002 không có đơn | 42501 đơn của chính admin |
-- 55000 đơn đã 'paid' (hoặc đã 'failed' khi mark_failed) | 23514 lý do ngoài 5..500 | 23505 mã giao dịch đã dùng ở đơn khác.
-- p_provider_tx_id: bắt buộc (trim, 1..100 ký tự) khi mark_paid và đơn CHƯA có provider_tx_id; đơn đã có thì giữ mã cũ.
create or replace function public.admin_resolve_order(
  p_admin uuid, p_order uuid, p_option text, p_reason text, p_provider_tx_id text default null
) returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  o         public.payment_orders;
  v_audit   bigint;
  v_applied boolean := false;
  v_balance int;
  v_tx      text := nullif(btrim(p_provider_tx_id), '');
  v_tx_new  text;
begin
  if p_option not in ('mark_paid', 'mark_failed') then
    raise exception 'option không hợp lệ' using errcode = '22023';
  end if;

  select * into o from public.payment_orders where id = p_order for update;
  if not found then
    raise exception 'đơn không tồn tại' using errcode = 'P0002';
  end if;
  -- Như adjust_credit: admin không tự cộng credit cho mình (cannot_target_self).
  if o.user_id = p_admin then
    raise exception 'không xử lý đơn của chính mình' using errcode = '42501';
  end if;
  if o.status = 'paid' or (p_option = 'mark_failed' and o.status = 'failed') then
    raise exception 'đơn ở trạng thái % không xử lý được', o.status using errcode = '55000';
  end if;
  if p_option = 'mark_paid' and o.provider_tx_id is null and (v_tx is null or length(v_tx) > 100) then
    raise exception 'thiếu hoặc sai mã giao dịch của ví (1..100 ký tự)' using errcode = '22023';
  end if;
  v_tx_new := case when p_option = 'mark_paid' then coalesce(o.provider_tx_id, v_tx) end;

  insert into public.admin_audit_log (admin_id, action, target_user_id, reason, payload)
  values (p_admin, 'order_' || p_option, o.user_id, btrim(p_reason),
          jsonb_build_object('order_id', o.id, 'provider', o.provider, 'provider_order_ref', o.provider_order_ref,
                             'from_status', o.status, 'amount_vnd', o.amount_vnd, 'credits', o.credits,
                             'provider_tx_id', v_tx_new))
  returning id into v_audit;

  if p_option = 'mark_failed' then
    update public.payment_orders set status = 'failed' where id = o.id;
  else
    -- unique (provider, provider_tx_id): mã đã gắn cho đơn khác -> 23505, cả transaction (audit) rollback.
    update public.payment_orders
       set status = 'paid', paid_at = coalesce(paid_at, now()), provider_tx_id = v_tx_new
     where id = o.id;
    perform public._ensure_credit_account(o.user_id);
    v_applied := public._apply_credit(o.user_id, o.credits, 'purchase', o.id::text);
    -- Phát lại tin treo là việc PHỤ (như fulfill_order): lỗi replay không rollback credit đã cộng.
    begin
      perform public.replay_held_messages(o.user_id);
    exception when others then
      raise warning 'replay_held_messages lỗi sau khi xử lý đơn (user %): % %', o.user_id, sqlstate, sqlerrm;
    end;
  end if;

  select b.balance into v_balance from public.credit_balances b where b.user_id = o.user_id;
  return jsonb_build_object('status', case p_option when 'mark_paid' then 'paid' else 'failed' end,
                            'credits', case when v_applied then o.credits else 0 end,
                            'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.admin_resolve_order(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_reconcile_status()                          from public, anon, authenticated;
revoke all on function public.admin_order_owner(uuid)                           from public, anon, authenticated;
grant execute on function public.admin_resolve_order(uuid, uuid, text, text, text) to service_role;
grant execute on function public.admin_reconcile_status()                          to service_role;
grant execute on function public.admin_order_owner(uuid)                           to service_role;

comment on function public.admin_resolve_order(uuid, uuid, text, text, text) is
  'Admin xử lý tay đơn thanh toán: mark_paid (bắt buộc mã giao dịch của ví nếu đơn chưa có) cộng credit đúng 1 lần, mark_failed đóng đơn. Audit cùng transaction. Chỉ service_role.';
