-- Đồng bộ employees.email từ auth.users (email đăng nhập)
-- Chạy một lần để backfill; có thể gọi lại qua RPC từ trang Admin.

-- Cập nhật tất cả nhân viên có id trùng auth user
UPDATE public.employees e
SET email = u.email
FROM auth.users u
WHERE e.id = u.id;

-- Hàm để Admin gọi từ UI (Đồng bộ email từ đăng nhập)
CREATE OR REPLACE FUNCTION public.sync_employee_emails_from_auth()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.employees e
  SET email = u.email
  FROM auth.users u
  WHERE e.id = u.id AND (e.email IS DISTINCT FROM u.email);
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.sync_employee_emails_from_auth() IS 'Đồng bộ cột email của employees từ auth.users (chỉ cập nhật khi khác). Trả về số dòng đã cập nhật.';

GRANT EXECUTE ON FUNCTION public.sync_employee_emails_from_auth() TO authenticated;
