-- ============================================================
-- PeopleFlow — Dữ liệu mẫu (chạy thử)
-- Chỉ chạy khi đã có user trong Authentication.
-- Thay YOUR_* bằng UUID thật từ Auth > Users.
-- ============================================================

-- 1. Phòng ban
INSERT INTO departments (code, name) VALUES
  ('IT', 'Phòng Công nghệ'),
  ('HR', 'Phòng Nhân sự')
ON CONFLICT (code) DO NOTHING;

-- 2. Nhân viên (ví dụ: 1 manager, 1 employee)
-- Lấy id từ: SELECT id FROM auth.users; và từ SELECT id FROM departments;
/*
INSERT INTO employees (id, employee_code, full_name, role, department_id, manager_id)
VALUES
  ('YOUR_MANAGER_AUTH_UID', 'M001', 'Tên Quản lý', 'manager', 'DEPT_UUID', NULL),
  ('YOUR_EMPLOYEE_AUTH_UID', 'NV001', 'Tên Nhân viên', 'employee', 'DEPT_UUID', 'YOUR_MANAGER_AUTH_UID');
*/

-- 3. Quỹ phép năm (ví dụ cho 1 nhân viên)
/*
INSERT INTO leave_balances (employee_id, year, total_minutes)
VALUES ('YOUR_EMPLOYEE_AUTH_UID', 2025, 5760)
ON CONFLICT (employee_id, year) DO NOTHING;
*/
