-- ============================================================
-- PeopleFlow — Sửa lỗi "Database error creating new user"
-- Nguyên nhân thường gặp: trigger trên auth.users chèn vào bảng
-- (vd. profiles) đã bị xóa → insert fail → tạo user fail.
-- Chạy trong Supabase SQL Editor.
-- ============================================================

-- Bước 1: Xem trigger nào đang gắn với auth.users (chạy để kiểm tra)
SELECT t.tgname AS trigger_name,
       p.proname AS function_name,
       n.nspname AS schema_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE t.tgrelid = 'auth.users'::regclass
  AND NOT t.tgisinternal;

-- Bước 2: Gỡ trigger (sửa tên trigger nếu khác trong bước 1)
-- Trigger hay gặp: on_auth_user_created, handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- Bước 3: Gỡ luôn function do trigger gọi (tránh lỗi khi tạo user)
-- Function hay gặp: public.handle_new_user()
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Sau đó thử tạo user lại trong Authentication → Users.
