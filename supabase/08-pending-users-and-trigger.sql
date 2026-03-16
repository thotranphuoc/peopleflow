-- ============================================================
-- PeopleFlow — Cho phép đăng ký, admin gán vai trò sau
-- Bảng pending_users + trigger khi user mới đăng ký
-- Chạy trong Supabase SQL Editor.
-- ============================================================

-- Bảng lưu user vừa đăng ký (chưa có trong employees)
CREATE TABLE IF NOT EXISTS pending_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function: khi có user mới trong auth.users thì thêm vào pending_users
CREATE OR REPLACE FUNCTION public.handle_new_user_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pending_users (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger trên auth.users (chạy sau khi insert user mới)
DROP TRIGGER IF EXISTS on_auth_user_created_pending ON auth.users;
CREATE TRIGGER on_auth_user_created_pending
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_pending();
-- Nếu báo lỗi quyền: tạo trigger từ Dashboard > Database > Extensions hoặc chạy với role postgres.
