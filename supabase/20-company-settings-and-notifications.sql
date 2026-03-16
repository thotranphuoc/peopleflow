-- Cài đặt công ty (1 bản ghi, dùng in phiếu lương / báo cáo)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS company_settings (
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

-- Chèn 1 dòng mặc định nếu chưa có
INSERT INTO company_settings (id, company_name)
SELECT uuid_generate_v4(), 'Công ty'
WHERE NOT EXISTS (SELECT 1 FROM company_settings LIMIT 1);

-- Thông báo trong app (đơn duyệt/từ chối, phiếu lương công bố...)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_employee ON notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(employee_id, read_at);
