-- Admin xem + xử lý tay đơn thanh toán (mismatch / failed / expired / pending). Chỉ service_role, qua edge function `admin`.
--
-- * admin_list_orders: metadata thuần (KHÔNG pay_url, KHÔNG payment_events/payload IPN), mới nhất trước, trần 200 dòng.
-- * admin_resolve_order: 'mark_paid' cộng credit của đơn ĐÚNG MỘT LẦN, 'mark_failed' đóng đơn. Audit ghi CÙNG transaction.
--   mark_paid dùng đúng khoá sổ cái của fulfill_order (kind 'purchase', ref = order.id): dù admin bấm 2 lần, IPN muộn
--   tới sau, hay cả hai, sổ cái unique (kind, ref) chỉ cho cộng một lần. Khoá dòng đơn (for update) cùng khoá với
--   fulfill_order nên 2 phiên song song tuần tự hoá; phiên sau thấy 'paid' -> 55000.
-- Không thêm policy admin bypass: các hàm này chỉ service_role execute.

alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check
  check (action in ('suspend', 'unsuspend', 'revoke_keys', 'view_user', 'adjust_credit',
                    'order_mark_paid', 'order_mark_failed'));

create or replace function public.admin_list_orders(
  p_status text default null, p_provider text default null, p_user uuid default null, p_limit int default 100
) returns table (
  id uuid, user_id uuid, provider text, provider_order_ref text, provider_tx_id text,
  amount_vnd bigint, credits int, status text, created_at timestamptz, paid_at timestamptz, last_checked_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_status is not null and p_status not in ('pending', 'paid', 'expired', 'failed', 'mismatch') then
    raise exception 'status không hợp lệ' using errcode = '22023';
  end if;
  if p_provider is not null and p_provider not in ('momo', 'zalopay') then
    raise exception 'provider không hợp lệ' using errcode = '22023';
  end if;
  return query
    select o.id, o.user_id, o.provider, o.provider_order_ref, o.provider_tx_id,
           o.amount_vnd, o.credits, o.status, o.created_at, o.paid_at, o.last_checked_at
      from public.payment_orders o
     where (p_status is null or o.status = p_status)
       and (p_provider is null or o.provider = p_provider)
       and (p_user is null or o.user_id = p_user)
     order by o.created_at desc, o.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

-- Lỗi: 22023 option lạ | P0002 không có đơn | 42501 đơn của chính admin | 55000 đơn đã 'paid' (hoặc đã 'failed' khi mark_failed) | 23514 lý do ngoài 5..500.
-- Trả { status, credits, balance }: credits = số credit vừa cộng (0 với mark_failed).
create or replace function public.admin_resolve_order(p_admin uuid, p_order uuid, p_option text, p_reason text)
returns jsonb
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

  insert into public.admin_audit_log (admin_id, action, target_user_id, reason, payload)
  values (p_admin, 'order_' || p_option, o.user_id, btrim(p_reason),
          jsonb_build_object('order_id', o.id, 'provider', o.provider, 'provider_order_ref', o.provider_order_ref,
                             'from_status', o.status, 'amount_vnd', o.amount_vnd, 'credits', o.credits))
  returning id into v_audit;

  if p_option = 'mark_failed' then
    update public.payment_orders set status = 'failed' where id = o.id;
  else
    update public.payment_orders set status = 'paid', paid_at = coalesce(paid_at, now()) where id = o.id;
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

revoke all on function public.admin_list_orders(text, text, uuid, int)         from public, anon, authenticated;
revoke all on function public.admin_resolve_order(uuid, uuid, text, text)     from public, anon, authenticated;
grant execute on function public.admin_list_orders(text, text, uuid, int)      to service_role;
grant execute on function public.admin_resolve_order(uuid, uuid, text, text)  to service_role;

comment on function public.admin_resolve_order(uuid, uuid, text, text) is
  'Admin xử lý tay đơn thanh toán: mark_paid cộng credit đúng 1 lần (khoá sổ cái như fulfill_order), mark_failed đóng đơn. Audit cùng transaction. Chỉ service_role.';
