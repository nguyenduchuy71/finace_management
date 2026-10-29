create extension if not exists pgcrypto;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
-- email_confirmed_at mặc định now(): user test coi như đã xác nhận (như Supabase local enable_confirmations=false).
-- Ca chưa xác nhận (credit-security-fixes.sql) insert tường minh email_confirmed_at = null.
create table auth.users(id uuid primary key, raw_user_meta_data jsonb, email_confirmed_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
