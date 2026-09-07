-- Baseline — bảng `transactions` nguyên bản.
--
-- Bảng này được tạo TAY qua Supabase dashboard nên chưa từng có migration nào
-- định nghĩa nó. Không có file này thì `supabase db reset` trên máy sạch sẽ fail
-- ("relation public.transactions does not exist") vì migration sau đó ALTER nó.
--
-- Nội dung khớp CHÍNH XÁC schema remote (dump 2026-09-07), kể cả `amount numeric`
-- — migration sau mới đổi sang bigint. Giữ đúng lịch sử để local == remote.

create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  bank_name        text not null,
  amount           numeric not null,
  currency         text not null default 'VND',
  transaction_date timestamptz not null,
  description      text,
  raw_text         text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_transactions_bank on public.transactions using btree (bank_name);
create index if not exists idx_transactions_date on public.transactions using btree (transaction_date);

alter table public.transactions enable row level security;
