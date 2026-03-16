-- Thêm cột P3 (lương theo tháng, manager cập nhật) vào payroll_configs.
-- Trang Tạo phiếu lương sẽ lấy giá trị này điền vào cột P3.
ALTER TABLE payroll_configs
  ADD COLUMN IF NOT EXISTS p3_salary DECIMAL(15, 2) NOT NULL DEFAULT 0;
