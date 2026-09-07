-- Phase 1 — Extend schema to match frontend contract.
--
-- Bảng `transactions` gốc chỉ có 8 cột (bank_name, amount, ...) — không đủ để dựng
-- BankAccount / CreditCard / Transaction mà UI cần. Migration này thêm 2 bảng entity
-- và các cột liên kết.
--
-- `amount` đổi numeric -> bigint: VND không có phần lẻ, và supabase-js serialize
-- `numeric` thành STRING trong JSON khiến Zod `z.number().int()` reject.

-- ---------------------------------------------------------------------------
-- accounts — khớp BankAccountSchema (src/types/account.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  bank_name      text not null,
  account_name   text not null,
  account_number text not null,                    -- masked, LUÔN dạng '****1234'
  account_type   text not null check (account_type in ('checking', 'savings')),
  currency       text not null default 'VND',
  balance        bigint not null default 0,
  last_updated   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- credit_cards — khớp CreditCardSchema (src/types/creditCard.ts)
-- credit_limit / statement_date / payment_due_date KHÔNG có trong SMS ngân hàng
-- nên bắt buộc nhập tay khi seed.
-- ---------------------------------------------------------------------------
create table if not exists public.credit_cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  bank_name        text not null,
  card_name        text not null,
  card_number      text not null,                  -- masked, LUÔN dạng '****5678'
  card_type        text not null check (card_type in ('visa', 'mastercard', 'jcb')),
  currency         text not null default 'VND',
  credit_limit     bigint not null default 0,
  current_balance  bigint not null default 0,
  statement_date   smallint not null check (statement_date between 1 and 31),
  payment_due_date smallint not null check (payment_due_date between 1 and 31),
  last_updated     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- transactions — đổi kiểu amount + thêm cột liên kết
-- ---------------------------------------------------------------------------

-- Row test cũ bị xoá (quyết định: làm lại sạch), nên không cần USING round(...)
-- phòng ngừa mất phần lẻ. Vẫn dùng USING để migration chạy được trên DB có data.
alter table public.transactions
  alter column amount type bigint using round(amount)::bigint;

alter table public.transactions
  add column if not exists user_id       uuid references auth.users(id) on delete cascade,
  add column if not exists source_type   text check (source_type in ('bank', 'credit_card')),
  add column if not exists account_ref   text,     -- 4 số cuối, dùng resolve FK
  add column if not exists account_id    uuid references public.accounts(id) on delete set null,
  add column if not exists card_id       uuid references public.credit_cards(id) on delete set null,
  add column if not exists merchant_name text,
  add column if not exists category      text,
  add column if not exists status        text not null default 'posted'
                                         check (status in ('pending', 'posted'));

-- account_id / card_id nullable: giao dịch chưa resolve được thẻ/TK vẫn phải giữ,
-- LƯU Ý: row FK null sẽ KHÔNG hiện trong danh sách giao dịch của UI hiện tại,
-- nhưng VẪN được RPC dashboard đếm -> số liệu 2 nơi lệch nhau.
-- Phải seed accounts/credit_cards khớp account_ref để tránh.

-- ---------------------------------------------------------------------------
-- Index — phục vụ query chính: lọc theo account/card, sort transaction_date desc
-- ---------------------------------------------------------------------------
create index if not exists idx_tx_user_date    on public.transactions (user_id, transaction_date desc);
create index if not exists idx_tx_account_date on public.transactions (account_id, transaction_date desc);
create index if not exists idx_tx_card_date    on public.transactions (card_id, transaction_date desc);
create index if not exists idx_tx_ref          on public.transactions (bank_name, account_ref);

create index if not exists idx_accounts_user     on public.accounts (user_id);
create index if not exists idx_credit_cards_user on public.credit_cards (user_id);

-- ---------------------------------------------------------------------------
-- unparsed_messages — SMS không khớp parser nào.
-- Trước đây bị vứt đi (chỉ trả JSON response); giữ lại để bổ sung parser sau.
-- ---------------------------------------------------------------------------
create table if not exists public.unparsed_messages (
  id          uuid primary key default gen_random_uuid(),
  raw_text    text not null,
  received_at timestamptz not null default now(),
  resolved    boolean not null default false
);
