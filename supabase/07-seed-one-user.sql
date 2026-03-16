-- ============================================================
-- PeopleFlow — Gắn user Auth với bảng employees (chạy 1 lần)
-- User ID: da41fbf6-f680-4a08-981f-4d7945c8a8d5
-- Sửa employee_code, full_name, role nếu cần.
-- ============================================================

-- 1. Đảm bảo có ít nhất 1 phòng ban
INSERT INTO departments (code, name) VALUES
  ('IT', 'Phòng Công nghệ'),
  ('HR', 'Phòng Nhân sự')
ON CONFLICT (code) DO NOTHING;

-- 2. Thêm user này vào bảng employees (bắt buộc để đăng nhập app)
INSERT INTO employees (id, employee_code, full_name, role, department_id, manager_id)
VALUES (
  'da41fbf6-f680-4a08-981f-4d7945c8a8d5',
  'NV001',
  'Người dùng',
  'admin',
  (SELECT id FROM departments LIMIT 1),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  employee_code = EXCLUDED.employee_code,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id,
  updated_at = NOW();

-- 3. Quỹ phép năm 2025 (tùy chọn)
INSERT INTO leave_balances (employee_id, year, total_minutes)
VALUES ('da41fbf6-f680-4a08-981f-4d7945c8a8d5', 2025, 5760)
ON CONFLICT (employee_id, year) DO NOTHING;
