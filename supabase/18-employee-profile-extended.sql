-- Mở rộng hồ sơ nhân viên (single source of truth): MST, BHXH, hợp đồng, loại hình, người phụ thuộc, liên hệ khẩn cấp

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS tax_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS social_insurance_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20) DEFAULT 'indefinite',
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) DEFAULT 'official',
  ADD COLUMN IF NOT EXISTS dependents_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
  ADD COLUMN IF NOT EXISTS id_issue_place VARCHAR(255),
  ADD COLUMN IF NOT EXISTS id_issue_date DATE,
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(100),
  ADD COLUMN IF NOT EXISTS resignation_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- contract_type: 'indefinite' | 'fixed'
-- employment_type: 'official' | 'probation' | 'contractor' | 'intern'
-- status: 'active' | 'left' | 'suspended'
