-- Postgres mặc định GRANT EXECUTE cho PUBLIC khi tạo function, nên `anon` (kế thừa PUBLIC) gọi được
-- các function dưới đây dù chưa từng được cấp. Security advisor / has_function_privilege('anon') trên
-- production (2026-10-27) liệt kê đúng 5 function này. Hiện chưa khai thác được (anon bị revoke mọi
-- bảng, function đều security invoker) nhưng get_dashboard_stats là RPC lộ ra qua PostgREST — đóng lại.
--
-- Function trigger / CHECK chỉ cần quyền với role thật sự ghi bảng (authenticated, service_role).

revoke execute on function public.get_dashboard_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_dashboard_stats(timestamptz, timestamptz) to authenticated;

revoke execute on function public.owner_names_ok(text[]) from public, anon;
grant execute on function public.owner_names_ok(text[]) to authenticated, service_role;

revoke execute on function public.api_keys_guard() from public, anon;
grant execute on function public.api_keys_guard() to authenticated, service_role;

revoke execute on function public.guard_unparsed_update() from public, anon;
grant execute on function public.guard_unparsed_update() to authenticated, service_role;

revoke execute on function public.admin_audit_log_immutable() from public, anon;
grant execute on function public.admin_audit_log_immutable() to service_role;

-- Function tạo SAU migration này (bởi role chạy migration) không còn tự mở cho PUBLIC/anon:
-- mỗi RPC mới phải `grant execute ... to authenticated` tường minh (quy ước sẵn có của repo).
-- PUBLIC phải thu ở mức GLOBAL: default privileges theo schema chỉ CỘNG thêm, không bớt được của PUBLIC.
-- anon thì Supabase cấp theo schema public, nên thu ở đúng mức đó.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
