-- Mở rộng hồ sơ nhân viên + bảng mức lương (P1, P2, P3) + gắn config với mức lương

-- 1. Thêm cột thông tin chi tiết vào employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS id_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS start_date DATE;

-- 2. Bảng mức lương (định nghĩa P1, P2, P3 theo bậc)
CREATE TABLE IF NOT EXISTS salary_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  p1_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
  p2_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
  p3_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Cấu hình lương có thể tham chiếu mức lương (để hiển thị "theo bậc X", pre-fill P1/P2/P3)
ALTER TABLE payroll_configs
  ADD COLUMN IF NOT EXISTS salary_grade_id UUID REFERENCES salary_grades(id) ON DELETE SET NULL;
