-- ============================================================
-- Chỉ tạo bảng pending_users (sửa lỗi PGRST205)
-- Chạy file này trong Supabase SQL Editor trước.
-- Sau đó nếu cần trigger tự thêm user mới, chạy tiếp 08-pending-users-and-trigger.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
