-- Phase 1 — RPC cho dashboard.
--
-- Aggregate ở DB thay vì kéo hết row về client.
-- Trả JSON khớp CHÍNH XÁC DashboardStatsSchema (src/services/dashboard.ts) để
-- service layer chỉ cần `DashboardStatsSchema.parse(data)`.
--
-- `security invoker` là QUYẾT ĐỊNH BẢO MẬT, không phải style: `security definer`
-- sẽ chạy dưới quyền owner và bypass RLS, làm rò data giữa các user.

create or replace function public.get_dashboard_stats(
  p_date_from timestamptz default null,
  p_date_to   timestamptz default null
)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select *
    from public.transactions
    where (p_date_from is null or transaction_date >= p_date_from)
      and (p_date_to   is null or transaction_date <= p_date_to)
  )
  select json_build_object(
    'totalIncome',
      coalesce((select sum(amount)      from filtered where amount > 0), 0),
    'totalExpense',
      coalesce((select abs(sum(amount)) from filtered where amount < 0), 0),
    'bankIncome',
      coalesce((select sum(amount)      from filtered where amount > 0 and source_type = 'bank'), 0),
    'bankExpense',
      coalesce((select abs(sum(amount)) from filtered where amount < 0 and source_type = 'bank'), 0),
    'ccIncome',
      coalesce((select sum(amount)      from filtered where amount > 0 and source_type = 'credit_card'), 0),
    'ccExpense',
      coalesce((select abs(sum(amount)) from filtered where amount < 0 and source_type = 'credit_card'), 0),
    'categoryBreakdown',
      coalesce((
        select json_agg(json_build_object('category', cat, 'amount', abs(total)))
        from (
          select coalesce(category, 'Khác') as cat, sum(amount) as total
          from filtered
          where amount < 0
          group by coalesce(category, 'Khác')
        ) c
      ), '[]'::json),
    'transactionCount',
      (select count(*) from filtered)
  );
$$;

-- RLS lọc `filtered` theo user đang gọi (nhờ security invoker), nên không cần
-- điều kiện user_id trong hàm.

grant execute on function public.get_dashboard_stats(timestamptz, timestamptz)
  to authenticated;
