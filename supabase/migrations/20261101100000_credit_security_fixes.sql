-- Sửa các phát hiện của review bảo mật hệ credit (plans/reports/code-reviewer-261029-1837-credit-ledger-security.md).
-- Chỉ một migration này đổi schema; các migration 20261030100000 / 20261031100000 đã áp, không sửa.
--
-- C1  authenticated hết quyền INSERT transactions (mọi giao dịch phải đi qua ingest_transaction / resolve_unparsed_charged).
-- H1  resolve_unparsed -> resolve_unparsed_charged (service_role, trừ 1 credit); hàm cũ bị gỡ.
-- H2  credit chào mừng chỉ cấp khi email đã xác nhận (lúc tạo user HOẶC khi email_confirmed_at null -> có giá trị).
-- H3  replay bỏ dòng hỏng sang reason 'invalid_payload' thay vì chặn cả hàng đợi.
-- M1  user không tự resolve được tin no_credit bằng UPDATE trực tiếp.
-- M2  ingest phát lại tin treo trước khi ghi tin mới (giữ thứ tự đến).
-- M5  discard_backfilled_tx: xoá giao dịch + hoàn credit trong MỘT transaction, chạy lại an toàn.
-- C2  admin_adjust_credit cộng credit thì phát lại tin treo. L2 chặn tràn int. L3 grant delete tường minh. L4 ghi chú sổ cái.
-- Thứ tự deploy: db push rồi deploy resolve-unparsed + parse-transaction + admin NGAY, và web (web cũ gọi RPC đã gỡ).

-- ---------------------------------------------------------------------------
-- 1. C1: bỏ đường ghi giao dịch không trừ credit
-- ---------------------------------------------------------------------------
-- user vẫn select/update/delete giao dịch của mình; chỉ INSERT là đi qua RPC service_role.
drop policy if exists "own_tx_insert" on public.transactions;
revoke insert on public.transactions from authenticated;

-- L3: backfill (service_role) xoá giao dịch / tin treo trùng — ghi quyền tường minh thay vì dựa vào mặc định Supabase.
grant delete on public.transactions, public.unparsed_messages to service_role;

-- L4: sổ cái KHÔNG có trigger chặn DELETE vì xoá user cascade qua FK cần xoá được dòng; quyền DELETE
-- chỉ service_role/owner có (authenticated bị revoke all) và UPDATE/TRUNCATE đã bị trigger chặn.
comment on table public.credit_ledger is
  'Sổ cái credit append-only. UPDATE/TRUNCATE bị trigger chặn; DELETE chỉ qua cascade khi xoá user (không trigger để cascade chạy được).';

-- ---------------------------------------------------------------------------
-- 2. H2: credit chào mừng chỉ sau khi xác nhận email
-- ---------------------------------------------------------------------------
-- _ensure_credit_account giờ CHỈ đảm bảo có hàng ví (số dư 0). Việc tặng credit tách sang _grant_welcome_credit
-- để các đường tự chữa (ingest, nạp tiền, admin) không vô tình tặng cho user chưa xác nhận.
create or replace function public._ensure_credit_account(p_user uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  insert into public.credit_balances (user_id) values (p_user) on conflict (user_id) do nothing;
end;
$$;

-- Idempotent: ref 'welcome:<uuid>' trùng thì _apply_credit bỏ qua (xác nhận lại email không tặng lần 2).
create or replace function public._grant_welcome_credit(p_user uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_welcome int;
begin
  perform public._ensure_credit_account(p_user);
  select welcome_credits into v_welcome from public.credit_settings;
  -- delta <> 0 nên bỏ qua khi cấu hình tặng 0.
  if coalesce(v_welcome, 0) > 0 then
    perform public._apply_credit(p_user, v_welcome, 'grant', 'welcome:' || p_user);
  end if;
end;
$$;

revoke all on function public._grant_welcome_credit(uuid) from public, anon, authenticated;
grant execute on function public._grant_welcome_credit(uuid) to service_role;

-- Vẫn là ngoại lệ security definer (trigger trên auth.users). Email đã xác nhận ngay lúc tạo
-- (vd enable_confirmations = false ở local, hoặc đăng nhập OAuth) thì tặng luôn.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text := nullif(new.raw_user_meta_data ->> 'privacy_policy_version', '');
begin
  insert into public.user_settings (user_id, privacy_policy_version, privacy_consent_at)
  values (new.id, v_version, case when v_version is not null then now() end)
  on conflict (user_id) do nothing;
  perform public._ensure_credit_account(new.id);
  if new.email_confirmed_at is not null then
    perform public._grant_welcome_credit(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Email chuyển từ chưa xác nhận sang đã xác nhận -> tặng (security definer vì cùng lý do với handle_new_user).
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._grant_welcome_credit(new.id);
  return new;
end;
$$;
revoke all on function public.handle_user_confirmed() from public, anon, authenticated;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- ---------------------------------------------------------------------------
-- 3. M1: guard_unparsed_update chặn client resolve tin no_credit
-- ---------------------------------------------------------------------------
-- Grant update (resolved, kind, transaction_id) cho authenticated vẫn còn (đổi grant sẽ vỡ test RLS cũ),
-- nên chặn ở trigger. service_role (replay, resolve_unparsed_charged) không bị ảnh hưởng.
create or replace function public.guard_unparsed_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.reason = 'no_credit' and not old.resolved and new.resolved
     and current_user in ('authenticated', 'anon') then
    raise exception 'message held: chờ nạp credit' using errcode = '22023';
  end if;
  if old.resolved and (new.resolved is distinct from old.resolved
     or new.kind is distinct from old.kind
     or new.transaction_id is distinct from old.transaction_id) then
    -- Ngoại lệ duy nhất: FK `on delete set null` khi giao dịch liên kết bị xoá.
    if not (new.transaction_id is null and old.transaction_id is not null
            and new.resolved = old.resolved and new.kind is not distinct from old.kind) then
      raise exception 'unparsed message already resolved' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. H1: resolve_unparsed_charged — phân loại thủ công TỐN 1 credit (chỉ service_role)
--
-- Thay public.resolve_unparsed (authenticated, ghi giao dịch miễn phí). Hàm cũ bị DROP chứ không chỉ revoke:
-- không để lại đường ghi miễn phí chờ ai đó grant nhầm lại. Gọi qua edge function `resolve-unparsed`
-- (xác thực JWT -> p_user). Kiểm hợp đồng p_tx giữ nguyên như hàm cũ.
-- Lỗi: 22003 hết credit | 42501 user bị khoá | P0002 tin/TK/thẻ không thấy hoặc không phải của user |
-- 22023 tham số sai / tin đã xử lý / tin đang treo chờ nạp.
-- Thứ tự khoá: số dư rồi tới tin (như ingest_transaction / replay_held_messages).
-- kind card_reminder / promo không tạo giao dịch -> miễn phí; user unlimited không bị trừ.
-- ---------------------------------------------------------------------------
drop function if exists public.resolve_unparsed(uuid, text, jsonb);

create or replace function public.resolve_unparsed_charged(
  p_user   uuid,
  p_msg_id uuid,
  p_kind   text,
  p_tx     jsonb default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  c_uuid       constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_balance    int;
  v_unlimited  boolean;
  v_msg        public.unparsed_messages%rowtype;
  v_tx_id      uuid;
  v_account_id uuid;
  v_card_id    uuid;
  v_amount     bigint;
  v_date       timestamptz;
  v_category   text;
  v_bank       text;
  v_source     text;
begin
  if p_user is null then
    raise exception 'p_user required' using errcode = '22023';
  end if;
  -- service_role bỏ qua RLS (not_suspended) nên kiểm cờ khoá tường minh ở đây.
  if exists (select 1 from public.user_settings where user_id = p_user and suspended_at is not null) then
    raise exception 'user suspended' using errcode = '42501';
  end if;

  select balance, unlimited into v_balance, v_unlimited
    from public.credit_balances where user_id = p_user for update;
  if not found then
    perform public._ensure_credit_account(p_user);
    select balance, unlimited into v_balance, v_unlimited
      from public.credit_balances where user_id = p_user for update;
  end if;

  -- Chỉ tin của CHÍNH p_user: service_role không bị RLS chặn nên lọc user_id ở đây.
  select * into v_msg from public.unparsed_messages where id = p_msg_id and user_id = p_user for update;
  if not found then
    raise exception 'unparsed message not found' using errcode = 'P0002';
  end if;
  if v_msg.resolved then
    raise exception 'unparsed message already resolved' using errcode = '22023';
  end if;
  -- Tin giữ vì hết credit chỉ replay_held_messages ghi (sau khi nạp), không tự phân loại.
  if v_msg.reason = 'no_credit' then
    raise exception 'message held: chờ nạp credit' using errcode = '22023';
  end if;

  if p_kind in ('normal', 'internal_transfer', 'cashback') then
    if p_tx is null then
      raise exception 'p_tx required for kind %', p_kind using errcode = '22023';
    end if;
    -- Kiểm định dạng TRƯỚC khi cast: cast sai ném 22P02/22003/22007, lệch hợp đồng lỗi 22023.
    if coalesce(p_tx->>'account_id', '') !~ ('(' || c_uuid || ')|^$')
       or coalesce(p_tx->>'card_id', '') !~ ('(' || c_uuid || ')|^$') then
      raise exception 'invalid account_id / card_id' using errcode = '22023';
    end if;
    v_account_id := nullif(p_tx->>'account_id', '')::uuid;
    v_card_id    := nullif(p_tx->>'card_id', '')::uuid;
    if (v_account_id is null) = (v_card_id is null) then
      raise exception 'exactly one of account_id / card_id required' using errcode = '22023';
    end if;

    -- Số nguyên VND, tối đa 15 chữ số (đủ xa giới hạn bigint).
    if coalesce(p_tx->>'amount', '') !~ '^-?[0-9]{1,15}$' then
      raise exception 'amount must be an integer' using errcode = '22023';
    end if;
    v_amount := (p_tx->>'amount')::bigint;
    if v_amount = 0 then
      raise exception 'amount must be non-zero' using errcode = '22023';
    end if;

    -- Bắt buộc có múi giờ: không có thì Postgres hiểu theo timezone session -> lệch 7 tiếng.
    if coalesce(p_tx->>'transaction_date', '')
       !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$' then
      raise exception 'transaction_date must be ISO-8601 with offset' using errcode = '22023';
    end if;
    begin
      v_date := (p_tx->>'transaction_date')::timestamptz;
    exception when others then
      raise exception 'invalid transaction_date' using errcode = '22023';
    end;

    -- Cùng tập Category của frontend (src/types/categories.ts); NULL = tự phân loại.
    v_category := nullif(trim(p_tx->>'category'), '');
    if v_category is not null
       and v_category not in ('Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Hóa đơn', 'Khác') then
      raise exception 'invalid category' using errcode = '22023';
    end if;

    -- TK/thẻ phải thuộc p_user (không có RLS để dựa vào).
    if v_account_id is not null then
      select bank_name into v_bank from public.accounts where id = v_account_id and user_id = p_user;
      v_source := 'bank';
    else
      select bank_name into v_bank from public.credit_cards where id = v_card_id and user_id = p_user;
      v_source := 'credit_card';
    end if;
    if v_bank is null then
      raise exception 'account or card not found' using errcode = 'P0002';
    end if;

    -- Hết credit: báo sau khi đầu vào đã hợp lệ (lỗi nhập liệu được báo trước lỗi thanh toán).
    if not v_unlimited and v_balance < 1 then
      raise exception 'insufficient credit' using errcode = '22003';
    end if;

    insert into public.transactions (
      user_id, bank_name, amount, transaction_date, description, merchant_name,
      category, raw_text, source_type, account_id, card_id, kind, status
    ) values (
      p_user, v_bank, v_amount, v_date,
      nullif(trim(p_tx->>'description'), ''), nullif(trim(p_tx->>'merchant_name'), ''),
      v_category, v_msg.raw_text, v_source,
      v_account_id, v_card_id, p_kind, 'posted'
    )
    returning id into v_tx_id;

    if not v_unlimited then
      perform public._apply_credit(p_user, -1, 'usage', v_tx_id::text);
    end if;
  elsif p_kind in ('card_reminder', 'promo') then
    if p_tx is not null then
      raise exception 'p_tx not allowed for kind %', p_kind using errcode = '22023';
    end if;
  else
    raise exception 'invalid kind %', p_kind using errcode = '22023';
  end if;

  update public.unparsed_messages
     set resolved = true, kind = p_kind, transaction_id = v_tx_id
   where id = p_msg_id;

  return v_tx_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. replay_held_messages: H3 bỏ dòng hỏng, từng dòng một subtransaction
--
-- P0002 / FK (TK-thẻ đã xoá) -> reason 'no_account'; lỗi dữ liệu (class 22: 22023, 22P02, 22007...) hoặc ràng buộc
-- (class 23) -> reason 'invalid_payload'. Cả hai ra khỏi hàng đợi (không còn 'no_credit') và hiện ở hộp tin để
-- user tự xử lý (phân loại thủ công tốn 1 credit). Chèn giao dịch + trừ credit + đánh dấu tin cùng một khối nên
-- dòng lỗi không để lại gì dang dở.
-- ---------------------------------------------------------------------------
create or replace function public.replay_held_messages(p_user uuid)
returns int
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_balance   int;
  v_unlimited boolean;
  v_count     int := 0;
  r           record;
  v_id        uuid;
begin
  select balance, unlimited into v_balance, v_unlimited
    from public.credit_balances where user_id = p_user for update;
  if not found then
    perform public._ensure_credit_account(p_user);
    select balance, unlimited into v_balance, v_unlimited
      from public.credit_balances where user_id = p_user for update;
  end if;

  for r in
    select id, parsed_payload from public.unparsed_messages
     where user_id = p_user and reason = 'no_credit' and not resolved
     order by received_at, id
     for update
  loop
    exit when not v_unlimited and v_balance < 1;
    begin
      v_id := public._insert_parsed_tx(p_user, r.parsed_payload -> 'tx', r.parsed_payload -> 'refs');
      if not v_unlimited then
        perform public._apply_credit(p_user, -1, 'usage', v_id::text);
      end if;
      update public.unparsed_messages
         set resolved = true, kind = coalesce(r.parsed_payload -> 'tx' ->> 'kind', 'normal'), transaction_id = v_id
       where id = r.id;
    exception
      when sqlstate 'P0002' or foreign_key_violation then
        update public.unparsed_messages set reason = 'no_account' where id = r.id;
        continue;
      when data_exception or integrity_constraint_violation then
        raise warning 'replay: tin % hỏng (%), chuyển sang invalid_payload', r.id, sqlstate;
        update public.unparsed_messages set reason = 'invalid_payload' where id = r.id;
        continue;
    end;
    if not v_unlimited then
      v_balance := v_balance - 1;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. ingest_transaction: M2 phát lại tin treo trước khi ghi tin mới
--
-- Có tin treo và đủ credit -> phát lại trước (cùng khoá số dư đã giữ), rồi đọc lại số dư: tin mới không chen
-- trước tin cũ. Replay là việc PHỤ: lỗi ngoài dự kiến chỉ cảnh báo (savepoint hoàn tác riêng phần replay).
-- ---------------------------------------------------------------------------
create or replace function public.ingest_transaction(
  p_user uuid, p_tx jsonb, p_refs jsonb, p_source text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  c_max_held constant int := 300;
  v_balance   int;
  v_unlimited boolean;
  v_id        uuid;
begin
  select balance, unlimited into v_balance, v_unlimited
    from public.credit_balances where user_id = p_user for update;
  if not found then
    perform public._ensure_credit_account(p_user);
    select balance, unlimited into v_balance, v_unlimited
      from public.credit_balances where user_id = p_user for update;
  end if;

  if (v_unlimited or v_balance >= 1) and exists (
       select 1 from public.unparsed_messages
        where user_id = p_user and reason = 'no_credit' and not resolved) then
    begin
      perform public.replay_held_messages(p_user);
    exception when others then
      raise warning 'replay_held_messages lỗi trong ingest (user %): % %', p_user, sqlstate, sqlerrm;
    end;
    select balance, unlimited into v_balance, v_unlimited
      from public.credit_balances where user_id = p_user;
  end if;

  if v_unlimited or v_balance >= 1 then
    v_id := public._insert_parsed_tx(p_user, p_tx, p_refs);
    if not v_unlimited then
      perform public._apply_credit(p_user, -1, 'usage', v_id::text);
    end if;
    return jsonb_build_object('status', 'inserted', 'id', v_id);
  end if;

  -- Đếm trong cùng khoá số dư nên trần không bị vượt khi nhiều tin đến cùng lúc.
  if (select count(*) from public.unparsed_messages
       where user_id = p_user and reason = 'no_credit' and not resolved) >= c_max_held then
    return jsonb_build_object('status', 'held_full');
  end if;

  insert into public.unparsed_messages (user_id, raw_text, source, reason, suggested_kind, parsed_payload)
  values (p_user, p_tx ->> 'raw_text', p_source, 'no_credit', 'transaction',
          jsonb_build_object('tx', p_tx, 'refs', p_refs))
  returning id into v_id;
  return jsonb_build_object('status', 'held', 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. admin_adjust_credit: C2 phát lại tin treo khi cộng, L2 chặn tràn int
--
-- Trả số dư SAU replay (replay có thể tiêu một phần credit vừa cộng). Replay lỗi không rollback điều chỉnh
-- (khối EXCEPTION như fulfill_order). Cộng vượt int4 -> 22023 (không còn bị gắn nhầm "hết credit" 22003).
-- ---------------------------------------------------------------------------
create or replace function public.admin_adjust_credit(p_admin uuid, p_user uuid, p_delta int, p_reason text)
returns int
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_balance  int;
  v_audit_id bigint;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'delta phải khác 0' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_settings where user_id = p_user) then
    raise exception 'user không tồn tại' using errcode = 'P0002';
  end if;

  perform public._ensure_credit_account(p_user);
  select balance into v_balance from public.credit_balances where user_id = p_user for update;
  -- Cộng bằng bigint: int + int tràn sẽ ném 22003 và bị hiểu nhầm là "không đủ số dư".
  if v_balance::bigint + p_delta < 0 then
    raise exception 'số dư không đủ để trừ' using errcode = '22003';
  end if;
  if v_balance::bigint + p_delta > 2147483647 then
    raise exception 'số dư vượt trần' using errcode = '22023';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, reason, payload)
  values (p_admin, 'adjust_credit', p_user, btrim(p_reason), jsonb_build_object('delta', p_delta))
  returning id into v_audit_id;

  perform public._apply_credit(p_user, p_delta, 'adjust', 'audit:' || v_audit_id);

  if p_delta > 0 then
    begin
      perform public.replay_held_messages(p_user);
    exception when others then
      raise warning 'replay_held_messages lỗi sau khi điều chỉnh (user %): % %', p_user, sqlstate, sqlerrm;
    end;
  end if;

  select balance into v_balance from public.credit_balances where user_id = p_user;
  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. M5: discard_backfilled_tx — xoá giao dịch backfill + hoàn credit nguyên tử
--
-- Chạy lại an toàn: giao dịch đã xoá thì delete 0 dòng; hoàn credit idempotent theo unique (kind='refund', ref).
-- Chỉ hoàn nếu đã có dòng usage của giao dịch này (user unlimited không bị trừ -> không hoàn). Trả true nếu vừa hoàn.
-- ---------------------------------------------------------------------------
create or replace function public.discard_backfilled_tx(p_user uuid, p_tx_id uuid)
returns boolean
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  perform public._ensure_credit_account(p_user);
  perform 1 from public.credit_balances where user_id = p_user for update;

  delete from public.transactions where id = p_tx_id and user_id = p_user;

  if exists (select 1 from public.credit_ledger
              where user_id = p_user and kind = 'usage' and ref = p_tx_id::text) then
    return public._apply_credit(p_user, 1, 'refund', p_tx_id::text);
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Quyền: chỉ service_role
-- ---------------------------------------------------------------------------
revoke all on function public.resolve_unparsed_charged(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.discard_backfilled_tx(uuid, uuid)                 from public, anon, authenticated;
grant execute on function public.resolve_unparsed_charged(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.discard_backfilled_tx(uuid, uuid)                 to service_role;

-- create or replace giữ nguyên quyền cũ, nhưng ghi lại tường minh cho các hàm vừa đổi.
revoke all on function public._ensure_credit_account(uuid)                   from public, anon, authenticated;
revoke all on function public.ingest_transaction(uuid, jsonb, jsonb, text)   from public, anon, authenticated;
revoke all on function public.replay_held_messages(uuid)                     from public, anon, authenticated;
revoke all on function public.admin_adjust_credit(uuid, uuid, int, text)     from public, anon, authenticated;
grant execute on function public._ensure_credit_account(uuid)                to service_role;
grant execute on function public.ingest_transaction(uuid, jsonb, jsonb, text) to service_role;
grant execute on function public.replay_held_messages(uuid)                  to service_role;
grant execute on function public.admin_adjust_credit(uuid, uuid, int, text)  to service_role;
