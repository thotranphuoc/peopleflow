-- Đổi company_settings (1 bản ghi) → companies (nhiều bản ghi), nhân viên gán company_id (nullable).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tạo bảng companies (cùng cấu trúc company_settings)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL DEFAULT 'Công ty',
  logo_url TEXT,
  address TEXT,
  tax_code VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Nếu đang có company_settings thì copy sang companies rồi xóa
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_settings') THEN
    INSERT INTO companies (id, company_name, logo_url, address, tax_code, phone, email, created_at, updated_at)
    SELECT id, company_name, logo_url, address, tax_code, phone, email, created_at, updated_at
    FROM company_settings;
    DROP TABLE company_settings CASCADE;
  END IF;
END $$;

-- 3. Thêm company_id vào employees (nullable; nhân viên cũ để null, Admin gán sau)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);

-- 4. Đảm bảo có ít nhất 1 công ty (cho DB mới không qua company_settings)
INSERT INTO companies (id, company_name)
SELECT uuid_generate_v4(), 'Công ty'
WHERE NOT EXISTS (SELECT 1 FROM companies LIMIT 1);
