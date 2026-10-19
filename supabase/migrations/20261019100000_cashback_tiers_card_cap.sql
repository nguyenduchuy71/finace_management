-- Hoàn tiền: bậc thang theo mức chi + trần tổng cho cả thẻ.
--
-- Bậc nền của một rule vẫn là (min_cycle_spend, rate_percent) trong card_cashback_rules,
-- nên rule cũ giữ nguyên. Bậc THÊM nằm ở bảng con; bậc cao nhất có min_spend <= chi của
-- nhóm thì áp % của nó cho CẢ khoản chi (tính ở client, không lưu số hoàn tiền).

-- ---------------------------------------------------------------------------
-- 1. Trần hoàn tiền tổng cho cả thẻ (mỗi kỳ sao kê). NULL = không giới hạn.
--    Policy/grant update của credit_cards đã có (chủ thẻ) nên không cần thêm.
-- ---------------------------------------------------------------------------
alter table public.credit_cards
  add column if not exists cashback_monthly_cap bigint
  check (cashback_monthly_cap > 0);

-- ---------------------------------------------------------------------------
-- 2. card_cashback_rule_tiers — bậc thang thêm của một rule
--
-- Bất biến liên dòng (tăng dần chặt, lớn hơn ngưỡng nền, tối đa 5 bậc) không diễn đạt được
-- bằng `check`; RPC save_cashback_rule kiểm. Tính toán ở client vẫn chịu được dữ liệu vi phạm.
-- ---------------------------------------------------------------------------
create table if not exists public.card_cashback_rule_tiers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
               references auth.users(id) on delete cascade,
  rule_id      uuid not null
               references public.card_cashback_rules(id) on delete cascade,
  min_spend    bigint not null check (min_spend > 0),
  rate_percent numeric(5,2) not null check (rate_percent between 0 and 100),
  created_at   timestamptz not null default now(),
  constraint card_cashback_rule_tiers_rule_min_key unique (rule_id, min_spend)
);

alter table public.card_cashback_rule_tiers enable row level security;

-- `rule_id` phải là rule của chính user (cùng lý do với own_rule_insert: FK một mình
-- cho phép gắn bậc vào rule của người khác). Subquery chạy dưới RLS của card_cashback_rules.
drop policy if exists "own_tier_select" on public.card_cashback_rule_tiers;
create policy "own_tier_select" on public.card_cashback_rule_tiers
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own_tier_insert" on public.card_cashback_rule_tiers;
create policy "own_tier_insert" on public.card_cashback_rule_tiers
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.card_cashback_rules r
      where r.id = rule_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "own_tier_update" on public.card_cashback_rule_tiers;
create policy "own_tier_update" on public.card_cashback_rule_tiers
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.card_cashback_rules r
      where r.id = rule_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "own_tier_delete" on public.card_cashback_rule_tiers;
create policy "own_tier_delete" on public.card_cashback_rule_tiers
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.card_cashback_rule_tiers from anon, authenticated;
grant select, insert, update, delete on public.card_cashback_rule_tiers to authenticated;

-- ---------------------------------------------------------------------------
-- 3. save_cashback_rule — lưu rule + bậc trong MỘT transaction
--
-- Client không tự chạy nhiều lệnh (rule lưu xong, bậc lỗi -> rule nửa vời). p_tiers là mảng
-- JSON [{"minSpend": 10000000, "ratePercent": 1}, ...]. p_rule_id NULL = tạo mới.
--
-- security INVOKER: RLS vẫn áp dụng (thẻ/rule của người khác -> 42501 hoặc P0002).
-- KHÔNG đổi sang definer. Trả về id của rule.
-- ---------------------------------------------------------------------------
create or replace function public.save_cashback_rule(
  p_card_id uuid,
  p_rule_id uuid,
  p_mcc     text,
  p_rate    numeric,
  p_min     bigint,
  p_cap     bigint,
  p_tiers   jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tiers jsonb := coalesce(p_tiers, '[]'::jsonb);
  v_id    uuid;
  v_prev  bigint := coalesce(p_min, 0);
  v_tier  record;
begin
  if jsonb_typeof(v_tiers) <> 'array' then
    raise exception 'Bậc thang phải là một danh sách' using errcode = '22023';
  end if;
  if jsonb_array_length(v_tiers) > 5 then
    raise exception 'Tối đa 5 bậc thang' using errcode = '22023';
  end if;

  for v_tier in
    select e, ord from jsonb_array_elements(v_tiers) with ordinality as t(e, ord) order by ord
  loop
    if jsonb_typeof(v_tier.e) <> 'object'
       or coalesce(v_tier.e->>'minSpend', '') !~ '^[0-9]{1,15}$'
       or coalesce(v_tier.e->>'ratePercent', '') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$'
    then
      raise exception 'Bậc % không hợp lệ', v_tier.ord using errcode = '22023';
    end if;
    if (v_tier.e->>'ratePercent')::numeric > 100 then
      raise exception 'Bậc %: tỷ lệ phải từ 0 đến 100', v_tier.ord using errcode = '22023';
    end if;
    if (v_tier.e->>'minSpend')::bigint <= v_prev then
      raise exception 'Bậc %: mức chi phải lớn hơn bậc trước (hoặc ngưỡng nền)', v_tier.ord
        using errcode = '22023';
    end if;
    v_prev := (v_tier.e->>'minSpend')::bigint;
  end loop;

  if p_rule_id is null then
    insert into card_cashback_rules(card_id, mcc, rate_percent, min_cycle_spend, cap_per_cycle)
    values (p_card_id, p_mcc, p_rate, p_min, p_cap)
    returning id into v_id;
  else
    -- UPDATE khoá dòng rule: hai lần lưu đồng thời trên cùng rule xếp hàng, không xen kẽ
    -- bậc của nhau. RLS lọc rule người khác -> 0 dòng -> not found.
    update card_cashback_rules
       set mcc = p_mcc, rate_percent = p_rate, min_cycle_spend = p_min, cap_per_cycle = p_cap
     where id = p_rule_id and card_id = p_card_id
    returning id into v_id;
    if v_id is null then
      raise exception 'cashback rule not found' using errcode = 'P0002';
    end if;
  end if;

  delete from card_cashback_rule_tiers where rule_id = v_id;
  insert into card_cashback_rule_tiers(rule_id, min_spend, rate_percent)
  select v_id, (e->>'minSpend')::bigint, (e->>'ratePercent')::numeric
  from jsonb_array_elements(v_tiers) as t(e);

  return v_id;
end;
$$;

revoke all on function public.save_cashback_rule(uuid, uuid, text, numeric, bigint, bigint, jsonb)
  from public, anon;
grant execute on function public.save_cashback_rule(uuid, uuid, text, numeric, bigint, bigint, jsonb)
  to authenticated;
